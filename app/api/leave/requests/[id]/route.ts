export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { checkPermission } from '@/lib/permissions';
import { notify } from '@/lib/notifications';

// PUT /api/leave/requests/[id] - Approve/reject leave request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    // Check permission to approve leave
    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'approve');
    if (!perm.allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to approve/reject leave requests' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, rejectionReason } = body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Valid status (APPROVED/REJECTED) is required' },
        { status: 400 }
      );
    }

    if (status === 'REJECTED' && !rejectionReason) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            reportingManagerId: true,
            departmentId: true,
          },
        },
        leaveType: { select: { name: true } },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      );
    }

    // BLOCK SELF-APPROVAL: No one can approve their own leave request
    if (leaveRequest.employeeId === user!.employeeDbId) {
      return NextResponse.json(
        { error: 'You cannot approve or reject your own leave request' },
        { status: 403 }
      );
    }

    // DEPARTMENT scope: can only approve requests from own department
    if (perm.scope === 'DEPARTMENT' && leaveRequest.employee.departmentId !== user!.departmentId) {
      return NextResponse.json(
        { error: 'Not authorized to approve requests from other departments' },
        { status: 403 }
      );
    }

    // Update leave request
    const updatedRequest = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status,
        approvedById: user!.employeeDbId,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    // Update leave balance
    const year = new Date(leaveRequest.startDate).getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
        },
      },
    });

    if (leaveBalance) {
      if (status === 'APPROVED') {
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            usedDays: { increment: leaveRequest.totalDays },
            pendingDays: { decrement: leaveRequest.totalDays },
          },
        });

        // Get employee's shift info for workDays and standard hours
        const employee = await prisma.employee.findUnique({
          where: { id: leaveRequest.employeeId },
          include: { shift: true },
        });
        const shiftWorkDays: number[] = employee?.shift?.workDays 
          ? (typeof employee.shift.workDays === 'string' ? JSON.parse(employee.shift.workDays) : employee.shift.workDays)
          : [1, 2, 3, 4, 5]; // default Mon-Fri

        // Get holidays in the leave date range
        const holidays = await prisma.holiday.findMany({
          where: {
            date: {
              gte: new Date(leaveRequest.startDate),
              lte: new Date(leaveRequest.endDate),
            },
          },
        });
        const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

        // Mark attendance as ON_LEAVE for working days only (skip weekends & holidays)
        const currentDate = new Date(leaveRequest.startDate);
        const endDate = new Date(leaveRequest.endDate);
        
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
          const dateStr = currentDate.toISOString().split('T')[0];
          const isWorkDay = shiftWorkDays.includes(dayOfWeek);
          const isHoliday = holidayDates.has(dateStr);

          // Only create ON_LEAVE record for actual working days
          if (isWorkDay && !isHoliday) {
            await prisma.attendance.upsert({
              where: {
                employeeId_date: {
                  employeeId: leaveRequest.employeeId,
                  date: new Date(currentDate),
                },
              },
              update: { status: 'ON_LEAVE' },
              create: {
                employeeId: leaveRequest.employeeId,
                date: new Date(currentDate),
                status: 'ON_LEAVE',
                // Store shift snapshot for consistency
                ...(employee?.shift ? {
                  shiftName: employee.shift.name,
                  shiftStartTime: employee.shift.startTime,
                  shiftEndTime: employee.shift.endTime,
                  shiftGraceTime: employee.shift.graceTime,
                  shiftStandardWorkHours: employee.shift.standardWorkHours,
                  shiftWorkDays: employee.shift.workDays as any,
                } : {}),
              },
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else {
        // Rejected - remove from pending
        await prisma.leaveBalance.update({
          where: { id: leaveBalance.id },
          data: {
            pendingDays: { decrement: leaveRequest.totalDays },
          },
        });
      }
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: status === 'APPROVED' ? ActivityActions.LEAVE_APPROVE : ActivityActions.LEAVE_REJECT,
      module: ActivityModules.LEAVE,
      resourceId: id,
      description: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} leave request for ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      request,
    });

    // Notify the employee about approval/rejection
    if (leaveRequest.employee.userId) {
      const leaveName = leaveRequest.leaveType?.name || 'Leave';
      const startStr = new Date(leaveRequest.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const endStr = new Date(leaveRequest.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const dateRange = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
      await notify({
        userId: leaveRequest.employee.userId,
        title: status === 'APPROVED' ? 'Leave Approved' : 'Leave Rejected',
        message: status === 'APPROVED'
          ? `Your ${leaveName} (${dateRange}, ${leaveRequest.totalDays} day${leaveRequest.totalDays > 1 ? 's' : ''}) has been approved`
          : `Your ${leaveName} (${dateRange}) was rejected${rejectionReason ? ': ' + rejectionReason : ''}`,
        type: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
        module: 'leave',
        resourceId: id,
        link: '/dashboard/employee-leave',
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: `Leave request ${status.toLowerCase()}`,
    });
  } catch (error) {
    console.error('Update leave request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/leave/requests/[id] - Cancel leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    // Only owner or users with leave.manage permission can cancel
    if (leaveRequest.employee.userId !== user!.userId) {
      const cancelPerm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
      if (!cancelPerm.allowed) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only pending requests can be cancelled' },
        { status: 400 }
      );
    }

    // Update status
    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Update leave balance
    const year = new Date(leaveRequest.startDate).getFullYear();
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: leaveRequest.employeeId,
          leaveTypeId: leaveRequest.leaveTypeId,
          year,
        },
      },
    });

    if (leaveBalance) {
      await prisma.leaveBalance.update({
        where: { id: leaveBalance.id },
        data: {
          pendingDays: { decrement: leaveRequest.totalDays },
        },
      });
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.LEAVE_CANCEL,
      module: ActivityModules.LEAVE,
      resourceId: id,
      description: `Cancelled leave request for ${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      request,
    });

    return NextResponse.json({
      success: true,
      message: 'Leave request cancelled',
    });
  } catch (error) {
    console.error('Cancel leave request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
