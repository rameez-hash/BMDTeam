export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

// GET /api/shifts - List shifts
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const shifts = await prisma.shift.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { employees: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: shifts,
    });
  } catch (error) {
    console.error('Get shifts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/shifts - Create shift
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'shifts', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      name, code, startTime, endTime, breakDuration, graceTime,
      earlyCheckInGrace, checkOutGrace, standardWorkHours, minCheckInGap, minWorkMinutes, workDays,
      halfDayThresholdMins, autoHalfDay
    } = body;

    if (!name || !code || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Name, code, start time, and end time are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.shift.findFirst({
      where: { OR: [{ name }, { code }] },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Shift with this name or code already exists' },
        { status: 409 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        code,
        startTime,
        endTime,
        breakDuration: breakDuration ?? 60,
        graceTime: graceTime ?? 15,
        earlyCheckInGrace: earlyCheckInGrace ?? 30,
        checkOutGrace: checkOutGrace ?? 15,
        standardWorkHours: standardWorkHours ?? 9,
        minCheckInGap: minCheckInGap ?? 180,
        minWorkMinutes: minWorkMinutes ?? 240,
        halfDayThresholdMins: halfDayThresholdMins ?? 240,
        autoHalfDay: autoHalfDay ?? false,
        workDays: workDays ?? [1,2,3,4,5],
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.SHIFT_CREATE,
      module: ActivityModules.SHIFT,
      resourceId: shift.id,
      description: `Created shift: ${name} (${startTime} - ${endTime})`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: shift,
    }, { status: 201 });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/shifts - Update shift
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'shifts', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Shift ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { 
      name, code, startTime, endTime, breakDuration, graceTime, isActive,
      earlyCheckInGrace, checkOutGrace, standardWorkHours, minCheckInGap, minWorkMinutes, workDays,
      halfDayThresholdMins, autoHalfDay
    } = body;

    const shift = await prisma.shift.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(breakDuration !== undefined && { breakDuration }),
        ...(graceTime !== undefined && { graceTime }),
        ...(earlyCheckInGrace !== undefined && { earlyCheckInGrace }),
        ...(checkOutGrace !== undefined && { checkOutGrace }),
        ...(standardWorkHours !== undefined && { standardWorkHours }),
        ...(minCheckInGap !== undefined && { minCheckInGap }),
        ...(minWorkMinutes !== undefined && { minWorkMinutes }),
        ...(halfDayThresholdMins !== undefined && { halfDayThresholdMins }),
        ...(autoHalfDay !== undefined && { autoHalfDay }),
        ...(workDays !== undefined && { workDays }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.SHIFT_UPDATE,
      module: ActivityModules.SHIFT,
      resourceId: shift.id,
      description: `Updated shift: ${shift.name}`,
      request,
    });

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/shifts - Delete shift
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'shifts', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Shift ID required' }, { status: 400 });
    }

    // Check if shift has employees
    const employeeCount = await prisma.employee.count({ where: { shiftId: id } });
    if (employeeCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete shift with ${employeeCount} employees assigned` },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: { isActive: false },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.SHIFT_DELETE,
      module: ActivityModules.SHIFT,
      resourceId: id,
      description: `Deleted shift: ${shift.name}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Shift deleted' });
  } catch (error) {
    console.error('Delete shift error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
