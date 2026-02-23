export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { formatDate, calculateWorkHours, calculateTotalBreakMinutes } from '@/lib/utils';
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
    // If checkout happens more than (shiftHours + 6h) after check-in, it's a missed checkout.
    // e.g. 8.3h shift + 6h = 14.3h max window. After that → missed.
    let isMissedCheckout = false;
    if (employee.shift && attendance.checkIn) {
      const shiftHours = attendance.shiftStandardWorkHours || employee.shift.standardWorkHours || 9;
      const maxCheckoutWindowHours = shiftHours + 6;
      const hoursSinceCheckIn = (now.getTime() - attendance.checkIn.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCheckIn > maxCheckoutWindowHours) {
        isMissedCheckout = true;
      }
    }

    // End any active break — cap at remaining quota
    const activeBreak = attendance.breaks.find(b => !b.endTime);
    if (activeBreak) {
      const allowedBreakMinutes = attendance.shiftBreakDuration ?? employee.shift?.breakDuration ?? 60;
      const usedClosed = attendance.breaks
        .filter(b => b.id !== activeBreak.id && b.endTime)
        .reduce((sum, b) => sum + Math.round((b.endTime!.getTime() - b.startTime.getTime()) / 60000), 0);
      const remainingQuota = Math.max(0, allowedBreakMinutes - usedClosed);
      const actualDuration = Math.round((now.getTime() - activeBreak.startTime.getTime()) / 60000);
      const cappedDuration = Math.min(actualDuration, remainingQuota);
      const effectiveEndTime = actualDuration > remainingQuota
        ? new Date(activeBreak.startTime.getTime() + cappedDuration * 60000)
        : now;

      await prisma.attendanceBreak.update({
        where: { id: activeBreak.id },
        data: {
          endTime: effectiveEndTime,
          duration: cappedDuration,
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
          ? `Checkout missed — checked out ${Math.round(minutesWorked / 60)}h after check-in (exceeded shift + 6h window). Contact HR to correct.`
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
        ? `${employee.firstName} ${employee.lastName} checkout missed for ${attendanceDate} — checked out ${Math.round(minutesWorked / 60)}h after check-in`
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
