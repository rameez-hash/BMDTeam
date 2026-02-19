export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { formatDate, getAttendanceDate, calculateLateArrival, isOffDay, getWorkDays, parseDateUTC, getDateStringPKT } from '@/lib/utils';

// POST /api/attendance/check-in
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const notes = body.notes || null;
    const workLocation = body.workLocation || 'OFFICE';

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
    
    // ── 1. Reject if employee already has an active session (checked in, no checkout) ──
    const activeSession = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: { date: 'desc' },
    });

    if (activeSession) {
      return NextResponse.json(
        { error: 'You are already checked in. Please check out first.' },
        { status: 400 }
      );
    }

    // ── 2. Enforce wait = MAX(minCheckInGap after checkout, shift end time) ──
    const lastCompleted = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: { not: null },
      },
      orderBy: { checkOut: 'desc' },
    });

    if (lastCompleted?.checkOut) {
      const minCheckInGap = employee.shift?.minCheckInGap || 180;
      const minutesSinceCheckOut = Math.round(
        (now.getTime() - lastCompleted.checkOut.getTime()) / 60000
      );

      if (minutesSinceCheckOut < minCheckInGap) {
        const remaining = minCheckInGap - minutesSinceCheckOut;
        const hrs = Math.floor(remaining / 60);
        const mins = remaining % 60;
        return NextResponse.json(
          { error: `Cannot check in yet. Please wait ${hrs > 0 ? hrs + 'h ' : ''}${mins}m more. Min gap: ${minCheckInGap} min.` },
          { status: 400 }
        );
      }
    }

    // ── 3. Determine the attendance date for this new check-in ──
    let attendanceDate: string;
    if (employee.shift) {
      attendanceDate = getAttendanceDate(
        now,
        employee.shift.startTime,
        employee.shift.endTime,
        employee.shift.earlyCheckInGrace
      );
    } else {
      attendanceDate = getDateStringPKT(now);
    }

    // ── 4. Check if attendance date is an off day ──
    const workDays = getWorkDays(employee.shift?.workDays);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    {
      const attendanceDateObj = parseDateUTC(attendanceDate);
      const dayOfWeek = attendanceDateObj.getUTCDay();
      if (isOffDay(dayOfWeek, workDays)) {
        return NextResponse.json(
          { error: `Cannot check in. ${dayNames[dayOfWeek]} (${attendanceDate}) is your off day.` },
          { status: 400 }
        );
      }
    }

    // ── 5. Look up any existing record for the computed date ──
    let existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: parseDateUTC(attendanceDate),
        },
      },
    });

    // If the computed date already has a completed record (night-shift overlap),
    // the user finished yesterday's shift and wants to start a new day.
    // Fall back to today's calendar date instead.
    if (existingAttendance?.checkIn && existingAttendance?.checkOut) {
      const todayDate = getDateStringPKT(now);
      if (attendanceDate !== todayDate) {
        attendanceDate = todayDate;

        // Re-check off day for the new date
        const newDateObj = parseDateUTC(attendanceDate);
        const newDayOfWeek = newDateObj.getUTCDay();
        if (isOffDay(newDayOfWeek, workDays)) {
          return NextResponse.json(
            { error: `Cannot check in. ${dayNames[newDayOfWeek]} (${attendanceDate}) is your off day.` },
            { status: 400 }
          );
        }

        existingAttendance = await prisma.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId: employee.id,
              date: parseDateUTC(attendanceDate),
            },
          },
        });
      }
    }

    // Block re-check-in if a completed session already exists for this date
    if (existingAttendance?.checkIn && existingAttendance?.checkOut) {
      return NextResponse.json(
        { error: `Attendance for ${attendanceDate} already recorded. Contact HR for corrections.` },
        { status: 400 }
      );
    }

    // Calculate late/early for this check-in (always recalculate fresh)
    let isLate = false;
    let lateMinutes = 0;
    let isEarly = false;
    let earlyMinutes = 0;
    let checkInMessage = 'Checked in successfully';

    if (employee.shift) {
      const lateInfo = calculateLateArrival(
        now, 
        employee.shift.startTime, 
        employee.shift.endTime,
        employee.shift.graceTime,
        attendanceDate
      );
      isLate = lateInfo.isLate;
      lateMinutes = lateInfo.lateMinutes;
      isEarly = lateInfo.isEarly;
      earlyMinutes = lateInfo.earlyMinutes;
      
      if (isEarly) {
        checkInMessage = `Checked in early (${earlyMinutes} minutes before shift)`;
      } else if (isLate) {
        checkInMessage = `Checked in late (${lateMinutes} minutes late)`;
      }
    }

    // Create or update attendance record (include shift snapshot for historical accuracy)
    const shiftSnapshot = employee.shift ? {
      shiftName: employee.shift.name,
      shiftStartTime: employee.shift.startTime,
      shiftEndTime: employee.shift.endTime,
      shiftBreakDuration: employee.shift.breakDuration,
      shiftGraceTime: employee.shift.graceTime,
      shiftStandardWorkHours: employee.shift.standardWorkHours,
      shiftWorkDays: employee.shift.workDays ?? [1,2,3,4,5],
    } : {};

    const attendance = existingAttendance
      ? await prisma.attendance.update({
          where: { id: existingAttendance.id },
          data: {
            checkIn: now,
            checkOut: null, // Reset checkout to allow new session
            workHours: null,
            overtime: null,
            status: 'PRESENT',
            isLate,        // Fresh calculation for this check-in
            lateMinutes,   // Fresh calculation for this check-in
            notes,
            workLocation,
            ...shiftSnapshot,
          },
          include: { breaks: true },
        })
      : await prisma.attendance.create({
          data: {
            employeeId: employee.id,
            date: parseDateUTC(attendanceDate),
            checkIn: now,
            status: 'PRESENT',
            isLate,
            lateMinutes,
            notes,
            workLocation,
            ...shiftSnapshot,
          },
          include: { breaks: true },
        });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.CHECK_IN,
      module: ActivityModules.ATTENDANCE,
      resourceId: attendance.id,
      description: `${employee.firstName} ${employee.lastName} ${checkInMessage} for ${attendanceDate}`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: attendance,
      message: checkInMessage,
      attendanceDate,
      isEarly,
      earlyMinutes,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
