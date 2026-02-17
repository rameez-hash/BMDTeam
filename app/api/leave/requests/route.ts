import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { getPaginationParams, calculateLeaveDays, parseDateUTC } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';
import { notifyMany, getUsersWithPermission } from '@/lib/notifications';

// GET /api/leave/requests - List leave requests
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // Dynamic permission-based filtering
    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    
    if (!perm.allowed) {
      // No manage permission: only see own leave requests
      where.employee = { userId: user!.userId };
    } else if (perm.scope === 'DEPARTMENT') {
      // DEPARTMENT scope: see department leave requests
      if (employeeId) {
        // Verify employee is in same department
        const targetEmp = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { departmentId: true },
        });
        if (targetEmp?.departmentId === user!.departmentId) {
          where.employeeId = employeeId;
        } else {
          where.employee = { userId: user!.userId };
        }
      } else {
        where.employee = { departmentId: user!.departmentId };
      }
    } else {
      // ALL scope: see all
      if (employeeId) {
        where.employeeId = employeeId;
      }
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
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
              department: { select: { name: true } },
            },
          },
          leaveType: true,
          approvedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get leave requests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/leave/requests - Submit leave request
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const body = await request.json();
    const { leaveTypeId, startDate, endDate, reason } = body;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'Leave type, dates, and reason are required' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { userId: user!.userId },
      include: { shift: { select: { workDays: true } } },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Admin does not need to apply for leave
    if (user!.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin does not need to apply for leave' },
        { status: 400 }
      );
    }

    // Check leave balance
    const year = new Date(startDate).getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: employee.id,
          leaveTypeId,
          year,
        },
      },
    });

    // Use employee's shift work days for accurate calculation
    const empWorkDays = (employee as { shift?: { workDays?: number[] } }).shift?.workDays || [1,2,3,4,5];
    const totalDays = calculateLeaveDays(parseDateUTC(startDate), parseDateUTC(endDate), true, empWorkDays);
    // Block leave on off-days/weekends
    if (totalDays === 0) {
      return NextResponse.json(
        { error: 'Selected dates fall on your off-days/weekends. Please select working days only.' },
        { status: 400 }
      );
    }
    
    if (leaveBalance) {
      const availableDays = leaveBalance.totalDays - leaveBalance.usedDays - leaveBalance.pendingDays;
      if (totalDays > availableDays) {
        return NextResponse.json(
          { error: `Insufficient leave balance. Available: ${availableDays} days` },
          { status: 400 }
        );
      }
    }

    // Check for overlapping requests
    const overlapping = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: new Date(endDate) },
            endDate: { gte: new Date(startDate) },
          },
        ],
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { error: 'You have an overlapping leave request' },
        { status: 400 }
      );
    }

    // Create leave request
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId,
        startDate: parseDateUTC(startDate),
        endDate: parseDateUTC(endDate),
        totalDays,
        reason,
      },
      include: {
        leaveType: true,
        employee: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    // Update pending days in balance
    if (leaveBalance) {
      await prisma.leaveBalance.update({
        where: { id: leaveBalance.id },
        data: {
          pendingDays: { increment: totalDays },
        },
      });
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.LEAVE_REQUEST,
      module: ActivityModules.LEAVE,
      resourceId: leaveRequest.id,
      description: `${employee.firstName} ${employee.lastName} submitted leave request for ${totalDays} days`,
      request,
    });

    // Notify managers/HR who can approve leave
    const approverIds = await getUsersWithPermission('leave', 'approve', employee.departmentId, user!.userId);
    await notifyMany(approverIds, {
      title: 'New Leave Request',
      message: `${employee.firstName} ${employee.lastName} requested ${totalDays} day(s) of ${leaveRequest.leaveType.name} leave`,
      type: 'LEAVE_REQUEST',
      module: 'leave',
      resourceId: leaveRequest.id,
      link: '/dashboard/leave',
    });

    return NextResponse.json({
      success: true,
      data: leaveRequest,
    }, { status: 201 });
  } catch (error) {
    console.error('Create leave request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
