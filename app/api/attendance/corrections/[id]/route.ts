import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { formatDate, calculateWorkHours, calculateLateArrival } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';
import { notify } from '@/lib/notifications';

// PUT /api/attendance/corrections/[id] - Approve/reject correction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    // Check permission to approve corrections
    const perm = await checkPermission(user!.userId, user!.role, 'attendance', 'approve');
    if (!perm.allowed) {
      return NextResponse.json(
        { error: 'You do not have permission to approve/reject correction requests' },
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

    const correction = await prisma.attendanceCorrection.findUnique({
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
      },
    });

    if (!correction) {
      return NextResponse.json(
        { error: 'Correction request not found' },
        { status: 404 }
      );
    }

    if (correction.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      );
    }

    // BLOCK SELF-APPROVAL: No one can approve their own correction
    if (correction.employeeId === user!.employeeDbId) {
      return NextResponse.json(
        { error: 'You cannot approve or reject your own correction request' },
        { status: 403 }
      );
    }

    // DEPARTMENT scope: can only approve corrections from own department
    if (perm.scope === 'DEPARTMENT' && correction.employee.departmentId !== user!.departmentId) {
      return NextResponse.json(
        { error: 'Not authorized to approve corrections from other departments' },
        { status: 403 }
      );
    }

    // Update correction status
    const updatedCorrection = await prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status,
        approvedById: user!.employeeDbId,
        approvedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });

    // If approved, update the attendance record
    if (status === 'APPROVED') {
      const dateStr = formatDate(correction.date);
      
      // Find or create attendance record
      let attendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: correction.employeeId,
            date: correction.date,
          },
        },
      });

      // Get employee shift for late/early recalculation
      const employee = await prisma.employee.findUnique({
        where: { id: correction.employeeId },
        include: { shift: true },
      });

      const checkIn = correction.requestedCheckIn || attendance?.checkIn;
      let checkOut = correction.requestedCheckOut || attendance?.checkOut;
      
      // Handle overnight/night shifts: if check-out is before check-in, it means next day
      if (checkIn && checkOut) {
        const ciDate = new Date(checkIn);
        let coDate = new Date(checkOut);
        if (coDate <= ciDate) {
          coDate.setDate(coDate.getDate() + 1);
          checkOut = coDate;
        }
      }

      let workHours = null;
      if (checkIn && checkOut) {
        workHours = calculateWorkHours(new Date(checkIn), new Date(checkOut), 0);
      }

      // Recalculate late/early from corrected check-in time + shift
      let correctedIsLate = false;
      let correctedLateMinutes = 0;
      if (checkIn && employee?.shift) {
        const lateInfo = calculateLateArrival(
          checkIn, employee.shift.startTime, employee.shift.endTime, employee.shift.graceTime, dateStr
        );
        correctedIsLate = lateInfo.isLate;
        correctedLateMinutes = lateInfo.lateMinutes;
      }

      // Build shift snapshot
      const shiftSnapshot = employee?.shift ? {
        shiftName: employee.shift.name,
        shiftStartTime: employee.shift.startTime,
        shiftEndTime: employee.shift.endTime,
        shiftBreakDuration: employee.shift.breakDuration,
        shiftGraceTime: employee.shift.graceTime,
        shiftStandardWorkHours: employee.shift.standardWorkHours,
      } : {};

      if (attendance) {
        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            checkIn,
            checkOut,
            workHours,
            isLate: correctedIsLate,
            lateMinutes: correctedLateMinutes,
            ...shiftSnapshot,
          },
        });
      } else {
        await prisma.attendance.create({
          data: {
            employeeId: correction.employeeId,
            date: correction.date,
            checkIn,
            checkOut,
            workHours,
            status: 'PRESENT',
            isLate: correctedIsLate,
            lateMinutes: correctedLateMinutes,
            ...shiftSnapshot,
          },
        });
      }
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: status === 'APPROVED' ? ActivityActions.ATTENDANCE_CORRECTION_APPROVE : ActivityActions.ATTENDANCE_CORRECTION_REJECT,
      module: ActivityModules.ATTENDANCE,
      resourceId: id,
      description: `${status === 'APPROVED' ? 'Approved' : 'Rejected'} attendance correction for ${correction.employee.firstName} ${correction.employee.lastName}`,
      request,
    });

    // Notify the employee about correction approval/rejection
    if (correction.employee.userId) {
      await notify({
        userId: correction.employee.userId,
        title: status === 'APPROVED' ? 'Correction Approved' : 'Correction Rejected',
        message: status === 'APPROVED'
          ? `Your attendance correction for ${new Date(correction.date).toLocaleDateString()} has been approved`
          : `Your attendance correction was rejected${rejectionReason ? ': ' + rejectionReason : ''}`,
        type: 'ATTENDANCE_CORRECTION',
        module: 'attendance',
        resourceId: id,
        link: '/dashboard/attendance',
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedCorrection,
      message: `Correction request ${status.toLowerCase()}`,
    });
  } catch (error) {
    console.error('Update correction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
