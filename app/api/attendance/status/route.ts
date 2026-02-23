export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { calculateTotalBreakMinutes , formatDate } from '@/lib/utils';

// GET /api/attendance/status - Get current attendance status
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

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

    // ── 1. Look for an active session (checked in, not checked out) ──
    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkIn: { not: null },
        checkOut: null,
      },
      orderBy: { date: 'desc' },
      include: { breaks: true },
    });

    if (activeAttendance) {
      // ── Auto-end break if quota exceeded ──
      const openBreak = activeAttendance.breaks.find(b => !b.endTime);
      if (openBreak) {
        const allowedBreakMinutes = activeAttendance.shiftBreakDuration ?? employee.shift?.breakDuration ?? 60;
        const usedClosed = calculateTotalBreakMinutes(
          activeAttendance.breaks.filter(b => b.id !== openBreak.id).map(b => ({ startTime: b.startTime, endTime: b.endTime }))
        );
        const remainingQuota = Math.max(0, allowedBreakMinutes - usedClosed);
        const currentBreakMinutes = Math.round((now.getTime() - openBreak.startTime.getTime()) / 60000);

        if (currentBreakMinutes >= remainingQuota) {
          // Auto-end this break at the quota limit
          const cappedEnd = new Date(openBreak.startTime.getTime() + remainingQuota * 60000);
          await prisma.attendanceBreak.update({
            where: { id: openBreak.id },
            data: { endTime: cappedEnd, duration: remainingQuota },
          });
          // Refresh breaks
          const refreshed = await prisma.attendance.findUnique({
            where: { id: activeAttendance.id },
            include: { breaks: true },
          });
          if (refreshed) {
            activeAttendance.breaks = refreshed.breaks;
          }
        }
      }

      const isOnBreak = activeAttendance.breaks.some(b => !b.endTime);
      const totalBreakMinutes = calculateTotalBreakMinutes(
        activeAttendance.breaks.map(b => ({ startTime: b.startTime, endTime: b.endTime }))
      );
      const currentWorkMinutes = Math.round(
        (now.getTime() - activeAttendance.checkIn!.getTime()) / 60000
      ) - totalBreakMinutes;

      return NextResponse.json({
        success: true,
        data: {
          status: 'CHECKED_IN',
          attendanceRecordStatus: activeAttendance.status,
          checkIn: activeAttendance.checkIn,
          checkOut: null,
          isOnBreak,
          totalBreakMinutes,
          currentWorkMinutes,
          workHours: null,
          isLate: activeAttendance.isLate,
          lateMinutes: activeAttendance.lateMinutes,
          shift: employee.shift,
          breaks: activeAttendance.breaks,
          attendanceDate: formatDate(activeAttendance.date),
        },
      });
    }

    // ── 2. No active session — check for the most recent completed session ──
    const lastCompleted = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        checkOut: { not: null },
      },
      orderBy: { checkOut: 'desc' },
      include: { breaks: true },
    });

    if (lastCompleted?.checkOut) {
      // Show CHECKED_OUT if checkout was within the last 24 hours
      const hoursSinceCheckout =
        (now.getTime() - lastCompleted.checkOut.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCheckout < 24) {
        const totalBreakMinutes = calculateTotalBreakMinutes(
          lastCompleted.breaks.map(b => ({ startTime: b.startTime, endTime: b.endTime }))
        );

        // Check if enough time has passed for re-check-in (uses minCheckInGap from shift settings)
        const minCheckInGap = employee.shift?.minCheckInGap || 180; // default 3 hours
        const minutesSinceCheckout = Math.round(
          (now.getTime() - lastCompleted.checkOut.getTime()) / 60000
        );
        const canCheckInAgain = minutesSinceCheckout >= minCheckInGap;
        const remainingGapMinutes = Math.max(0, minCheckInGap - minutesSinceCheckout);

        return NextResponse.json({
          success: true,
          data: {
            status: 'CHECKED_OUT',
            attendanceRecordStatus: lastCompleted.status,
            checkIn: lastCompleted.checkIn,
            checkOut: lastCompleted.checkOut,
            isOnBreak: false,
            totalBreakMinutes,
            currentWorkMinutes: Math.round((lastCompleted.workHours ?? 0) * 60),
            workHours: lastCompleted.workHours,
            isLate: lastCompleted.isLate,
            lateMinutes: lastCompleted.lateMinutes,
            shift: employee.shift,
            breaks: lastCompleted.breaks,
            attendanceDate: formatDate(lastCompleted.date),
            canCheckInAgain,
            remainingGapMinutes,
            minCheckInGap,
          },
        });
      }
    }

    // ── 3. No recent activity ──
    return NextResponse.json({
      success: true,
      data: {
        status: 'NOT_CHECKED_IN',
        checkIn: null,
        checkOut: null,
        isOnBreak: false,
        totalBreakMinutes: 0,
        currentWorkMinutes: 0,
        shift: employee.shift,
      },
    });
  } catch (error) {
    console.error('Get status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
