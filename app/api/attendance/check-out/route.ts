export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { formatDate, calculateWorkHours, calculateTotalBreakMinutes, isNightShift, getDateStringPKT, createDateFromPKT } from '@/lib/utils';
import { notify, notifyMany, getUsersWithPermission } from '@/lib/notifications';

// POST /api/attendance/check-out
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const notes = body.notes || null;

    // Get employee with shift
    const employee = await prisma.employee.findFirst({
      where: { userId: user!.userId },
      include: { shift: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Find the ACTIVE attendance session (checked in, not yet checked out).
    // This naturally handles night shifts — no date recomputation needed.
    const attendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: { date: 'desc' },
      include: { breaks: true },
    });

    if (!attendance?.checkIn) {
      return NextResponse.json(
        { error: 'Please check in first' },
        { status: 400 }
      );
    }

    // Derive attendance date from the found record (not recomputed)
    const attendanceDate = formatDate(attendance.date);

    // Enforce minimum work time before checkout is allowed
    const minWorkMinutes = employee.shift?.minWorkMinutes || 240; // default 4 hours
    const minutesWorked = Math.round((now.getTime() - attendance.checkIn.getTime()) / 60000);
    if (minutesWorked < minWorkMinutes) {
      const remaining = minWorkMinutes - minutesWorked;
      const hrs = Math.floor(remaining / 60);
      const mins = remaining % 60;
      return NextResponse.json(
        { error: `Cannot check out yet. Minimum work time is ${Math.floor(minWorkMinutes / 60)}h ${minWorkMinutes % 60}m. You need ${hrs > 0 ? hrs + 'h ' : ''}${mins}m more.` },
        { status: 400 }
      );
    }

    // ── Missed checkout detection ──
    // If the current checkout time falls within 4 hours before the NEXT shift start,
    // the employee likely forgot to checkout yesterday and is pressing it now before today's shift.
    let isMissedCheckout = false;
    if (employee.shift) {
      const shiftStart = employee.shift.startTime; // e.g. "09:00"
      const shiftEnd = employee.shift.endTime;     // e.g. "18:00"
      const todayPKT = getDateStringPKT(now);
      
      // Build today's shift start as a PKT date
      let nextShiftStart = createDateFromPKT(todayPKT, shiftStart);
      
      // For night shifts, if now is before shift end (after midnight portion), 
      // "next" shift start is tonight, not this morning
      const isNight = isNightShift(shiftStart, shiftEnd);
      if (isNight) {
        // Night shift e.g. 21:00-06:00 
        // If now is in the morning (before shift end), next shift start is tonight (same calendar day)
        // If now is in the evening, next shift start is today
        // nextShiftStart is already set to today's 21:00, which is correct
      }
      
      // If nextShiftStart is in the past, push it to tomorrow
      if (nextShiftStart.getTime() <= now.getTime()) {
        const tomorrowPKT = getDateStringPKT(new Date(now.getTime() + 24 * 60 * 60 * 1000));
        nextShiftStart = createDateFromPKT(tomorrowPKT, shiftStart);
      }
      
      const hoursUntilNextShift = (nextShiftStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // If checking out within 4 hours before next shift start → missed checkout
      if (hoursUntilNextShift <= 4) {
        isMissedCheckout = true;
      }
    }

    // End any active break
    const activeBreak = attendance.breaks.find(b => !b.endTime);
    if (activeBreak) {
      await prisma.attendanceBreak.update({
        where: { id: activeBreak.id },
        data: {
          endTime: now,
          duration: Math.round((now.getTime() - activeBreak.startTime.getTime()) / 60000),
        },
      });
    }

    // Calculate work hours
    const breaks = await prisma.attendanceBreak.findMany({
      where: { attendanceId: attendance.id },
    });

    const totalBreakMinutes = calculateTotalBreakMinutes(
      breaks.map(b => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }))
    );

    const workHours = calculateWorkHours(attendance.checkIn, now, totalBreakMinutes);
    
    // Use shift snapshot from attendance record first, then fall back to live shift data
    const standardWorkHours = attendance.shiftStandardWorkHours || employee.shift?.standardWorkHours || 9;
    
    // Overtime is ONLY counted when full working hours are completed
    // e.g., shift 21:00-06:00 = 9 hrs standard. If worked 7 hrs → overtime = 0
    // If worked 10 hrs → overtime = 1 (only because 10 > 9)
    const overtime = workHours >= standardWorkHours
      ? Math.round((workHours - standardWorkHours) * 100) / 100
      : 0;

    // Auto Half Day: if enabled in shift and work minutes below threshold
    const autoHalfDay = employee.shift?.autoHalfDay ?? false;
    const halfDayThreshold = employee.shift?.halfDayThresholdMins ?? 240;
    const workedMinutes = Math.round(workHours * 60);
    const newStatus = (autoHalfDay && workedMinutes < halfDayThreshold) ? 'HALF_DAY' : undefined;

    // Update attendance
    const shortHours = workHours < standardWorkHours
      ? Math.round((standardWorkHours - workHours) * 100) / 100
      : 0;

    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkOut: now,
        workHours: isMissedCheckout ? 0 : workHours,
        overtime: isMissedCheckout ? 0 : overtime,
        checkoutMissing: isMissedCheckout,
        notes: isMissedCheckout
          ? `Checkout missed — checked out ${Math.round(minutesWorked / 60)}h after check-in (near next shift). Contact HR to correct.`
          : (notes || attendance.notes),
        ...(newStatus && !isMissedCheckout && { status: newStatus }),
      },
      include: { breaks: true },
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.CHECK_OUT,
      module: ActivityModules.ATTENDANCE,
      resourceId: attendance.id,
      description: isMissedCheckout
        ? `${employee.firstName} ${employee.lastName} checkout missed for ${attendanceDate} — checked out near next shift start`
        : `${employee.firstName} ${employee.lastName} checked out for ${attendanceDate} (${workHours.toFixed(2)} hours worked)`,
      request,
    });

    // ── Notifications for missed checkout ──
    if (isMissedCheckout) {
      // Notify employee
      await notify({
        userId: user!.userId,
        title: 'Checkout Missed',
        message: `Your checkout for ${attendanceDate} was marked as missed because you checked out near your next shift start. Work hours set to 0. Please request a correction or contact HR.`,
        type: 'WARNING',
        module: 'attendance',
        resourceId: attendance.id,
        link: '/dashboard/attendance',
      });

      // Notify admin/HR
      const adminIds = await getUsersWithPermission('attendance', 'manage', employee.departmentId, user!.userId);
      await notifyMany(adminIds, {
        title: 'Employee Checkout Missed',
        message: `${employee.firstName} ${employee.lastName} checkout for ${attendanceDate} was marked as missed (checked out near next shift). Please review and correct if needed.`,
        type: 'WARNING',
        module: 'attendance',
        resourceId: attendance.id,
        link: '/dashboard/attendance',
      });
    }

    if (isMissedCheckout) {
      return NextResponse.json({
        success: true,
        data: updatedAttendance,
        message: `Checkout marked as MISSED for ${attendanceDate}. You checked out near your next shift start. Work hours set to 0. Please request a correction or contact HR.`,
        attendanceDate,
        checkoutMissing: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedAttendance,
      message: newStatus === 'HALF_DAY'
        ? `Checked out. ${workHours.toFixed(2)} hours worked — marked as Half Day`
        : overtime > 0
        ? `Checked out. ${workHours.toFixed(2)} hours worked (${overtime.toFixed(2)} hrs overtime)`
        : shortHours > 0
        ? `Checked out. ${workHours.toFixed(2)} hours worked (${shortHours.toFixed(2)} hrs short of standard)`
        : `Checked out successfully. Total work hours: ${workHours.toFixed(2)}`,
      attendanceDate,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
