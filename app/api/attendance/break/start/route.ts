export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { calculateTotalBreakMinutes } from '@/lib/utils';

// POST /api/attendance/break/start
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || null;

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
        { error: 'Please check in first' },
        { status: 400 }
      );
    }

    // Check if already on break
    const activeBreak = attendance.breaks.find(b => !b.endTime);
    if (activeBreak) {
      return NextResponse.json(
        { error: 'Already on break' },
        { status: 400 }
      );
    }

    // ── Break quota check ──
    const allowedBreakMinutes = attendance.shiftBreakDuration ?? employee.shift?.breakDuration ?? 60;
    const usedBreakMinutes = calculateTotalBreakMinutes(
      attendance.breaks.map(b => ({ startTime: b.startTime, endTime: b.endTime }))
    );

    if (usedBreakMinutes >= allowedBreakMinutes) {
      return NextResponse.json(
        { error: `Break quota finished (${usedBreakMinutes}m / ${allowedBreakMinutes}m used). No more breaks allowed today.` },
        { status: 400 }
      );
    }

    // Start break
    const newBreak = await prisma.attendanceBreak.create({
      data: {
        attendanceId: attendance.id,
        startTime: now,
        reason,
      },
    });

    const remainingBreak = allowedBreakMinutes - usedBreakMinutes;

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.BREAK_START,
      module: ActivityModules.ATTENDANCE,
      resourceId: newBreak.id,
      description: `${employee.firstName} ${employee.lastName} started break (${remainingBreak}m remaining)`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: newBreak,
      message: `Break started. ${remainingBreak}m remaining of ${allowedBreakMinutes}m quota.`,
      remainingBreakMinutes: remainingBreak,
      allowedBreakMinutes,
    });
  } catch (error) {
    console.error('Start break error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
