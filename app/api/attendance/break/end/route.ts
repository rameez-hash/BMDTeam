export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { calculateTotalBreakMinutes } from '@/lib/utils';

// POST /api/attendance/break/end
export async function POST(request: NextRequest) {
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

    // Find the active attendance session (checked in, not checked out)
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
        { error: 'No attendance record found' },
        { status: 400 }
      );
    }

    // Find active break
    const activeBreak = attendance.breaks.find(b => !b.endTime);
    if (!activeBreak) {
      return NextResponse.json(
        { error: 'Not currently on break' },
        { status: 400 }
      );
    }

    // Calculate actual duration
    const actualDuration = Math.round((now.getTime() - activeBreak.startTime.getTime()) / 60000);

    // ── Cap at remaining quota ──
    const allowedBreakMinutes = attendance.shiftBreakDuration ?? employee.shift?.breakDuration ?? 60;
    const usedBreakMinutes = calculateTotalBreakMinutes(
      attendance.breaks.filter(b => b.id !== activeBreak.id).map(b => ({ startTime: b.startTime, endTime: b.endTime }))
    );
    const remainingQuota = Math.max(0, allowedBreakMinutes - usedBreakMinutes);
    const cappedDuration = Math.min(actualDuration, remainingQuota);
    const wasCapped = actualDuration > remainingQuota;

    // If capped, adjust the endTime to match the capped duration
    const effectiveEndTime = wasCapped
      ? new Date(activeBreak.startTime.getTime() + cappedDuration * 60000)
      : now;

    // End break
    const updatedBreak = await prisma.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: {
        endTime: effectiveEndTime,
        duration: cappedDuration,
      },
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.BREAK_END,
      module: ActivityModules.ATTENDANCE,
      resourceId: updatedBreak.id,
      description: wasCapped
        ? `${employee.firstName} ${employee.lastName} ended break — capped at ${cappedDuration}m (was ${actualDuration}m, quota: ${allowedBreakMinutes}m)`
        : `${employee.firstName} ${employee.lastName} ended break (${cappedDuration} minutes)`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: wasCapped
        ? `Break ended. Duration capped at ${cappedDuration}m (quota: ${allowedBreakMinutes}m). Actual time was ${actualDuration}m.`
        : `Break ended. Duration: ${cappedDuration} minutes`,
      wasCapped,
    });
  } catch (error) {
    console.error('End break error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
