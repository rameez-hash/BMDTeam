import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

// POST /api/attendance/break/end
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const employee = await prisma.employee.findFirst({
      where: { userId: user!.userId },
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

    // Calculate duration
    const duration = Math.round((now.getTime() - activeBreak.startTime.getTime()) / 60000);

    // End break
    const updatedBreak = await prisma.attendanceBreak.update({
      where: { id: activeBreak.id },
      data: {
        endTime: now,
        duration,
      },
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.BREAK_END,
      module: ActivityModules.ATTENDANCE,
      resourceId: updatedBreak.id,
      description: `${employee.firstName} ${employee.lastName} ended break (${duration} minutes)`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: updatedBreak,
      message: `Break ended. Duration: ${duration} minutes`,
    });
  } catch (error) {
    console.error('End break error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
