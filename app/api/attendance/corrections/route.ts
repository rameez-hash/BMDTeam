import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { getPaginationParams } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';
import { notifyMany, getUsersWithPermission } from '@/lib/notifications';

// GET /api/attendance/corrections - List correction requests
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // Dynamic permission-based filtering
    const perm = await checkPermission(user!.userId, user!.role, 'attendance', 'approve');
    
    if (!perm.allowed) {
      // No approve permission: only see own corrections
      where.employee = { userId: user!.userId };
    } else if (perm.scope === 'DEPARTMENT') {
      // DEPARTMENT scope: see own + department corrections (but exclude own from approval list)
      where.employee = { departmentId: user!.departmentId };
    } else {
      // ALL scope: see all corrections
    }

    const [corrections, total] = await Promise.all([
      prisma.attendanceCorrection.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.attendanceCorrection.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: corrections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get corrections error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/attendance/corrections - Submit correction request
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json();
    const { date, requestedCheckIn, requestedCheckOut, reason } = body;

    if (!date || !reason) {
      return NextResponse.json(
        { error: 'Date and reason are required' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: user!.userId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Get original attendance
    const originalAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: new Date(date),
        },
      },
    });

    // Check for existing pending request
    const existingRequest = await prisma.attendanceCorrection.findFirst({
      where: {
        employeeId: employee.id,
        date: new Date(date),
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: 'A pending correction request already exists for this date' },
        { status: 400 }
      );
    }

    const correction = await prisma.attendanceCorrection.create({
      data: {
        employeeId: employee.id,
        date: new Date(date),
        originalCheckIn: originalAttendance?.checkIn,
        originalCheckOut: originalAttendance?.checkOut,
        requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
        requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
        reason,
      },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.ATTENDANCE_CORRECTION_REQUEST,
      module: ActivityModules.ATTENDANCE,
      resourceId: correction.id,
      description: `${employee.firstName} ${employee.lastName} submitted attendance correction request for ${date}`,
      request,
    });

    // Notify managers/HR who can approve corrections
    const approverIds = await getUsersWithPermission('attendance', 'approve', employee.departmentId, user!.userId);
    await notifyMany(approverIds, {
      title: 'Attendance Correction Request',
      message: `${employee.firstName} ${employee.lastName} requested attendance correction for ${new Date(date).toLocaleDateString()}`,
      type: 'ATTENDANCE_CORRECTION',
      module: 'attendance',
      resourceId: correction.id,
      link: '/dashboard/attendance',
    });

    return NextResponse.json({
      success: true,
      data: correction,
    }, { status: 201 });
  } catch (error) {
    console.error('Create correction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
