export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/payroll/settings - Get payroll settings for a month
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (month && year) {
      // Get specific month settings
      const settings = await prisma.payrollSettings.findUnique({
        where: {
          month_year: {
            month: parseInt(month),
            year: parseInt(year),
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: settings || {
          month: parseInt(month),
          year: parseInt(year),
          attendanceLockDay: 0,
          isAttendanceLocked: false,
          isPayrollLocked: false,
          payrollLockDay: 0,
          payrollClosingDay: 5,
        },
      });
    }

    // Get all settings
    const settings = await prisma.payrollSettings.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 24, // Last 2 years
    });

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Get payroll settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/payroll/settings - Create or update payroll settings
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { month, year, attendanceLockDay, payrollClosingDay, payrollLockDay, notes } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    // If payrollLockDay is being changed, also reset/update auto-lock status
    const lockDayVal = payrollLockDay ?? 0;
    const today = new Date();
    const lockDate = lockDayVal > 0 ? new Date(parseInt(year), parseInt(month) - 1, lockDayVal) : null;
    const shouldAutoLock = lockDate ? today >= lockDate : false;

    const settings = await prisma.payrollSettings.upsert({
      where: {
        month_year: {
          month: parseInt(month),
          year: parseInt(year),
        },
      },
      update: {
        attendanceLockDay: attendanceLockDay ?? 0,
        payrollClosingDay: payrollClosingDay ?? 5,
        payrollLockDay: lockDayVal,
        isPayrollLocked: shouldAutoLock,
        payrollLockedAt: shouldAutoLock ? new Date() : null,
        notes,
      },
      create: {
        month: parseInt(month),
        year: parseInt(year),
        attendanceLockDay: attendanceLockDay ?? 0,
        payrollClosingDay: payrollClosingDay ?? 5,
        payrollLockDay: lockDayVal,
        isPayrollLocked: shouldAutoLock,
        payrollLockedAt: shouldAutoLock ? new Date() : null,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      data: settings,
      message: 'Payroll settings saved',
    });
  } catch (error) {
    console.error('Save payroll settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/payroll/settings - Lock attendance for a month
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { month, year, lockAttendance, lockPayroll } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    // Build update/create data based on what's being toggled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (lockAttendance !== undefined) {
      updateData.isAttendanceLocked = lockAttendance;
      updateData.attendanceLockedAt = lockAttendance ? new Date() : null;
    }

    if (lockPayroll !== undefined) {
      updateData.isPayrollLocked = lockPayroll;
      updateData.payrollLockedAt = lockPayroll ? new Date() : null;
    }

    const settings = await prisma.payrollSettings.upsert({
      where: {
        month_year: {
          month: parseInt(month),
          year: parseInt(year),
        },
      },
      update: updateData,
      create: {
        month: parseInt(month),
        year: parseInt(year),
        ...updateData,
      },
    });

    let message = '';
    if (lockAttendance !== undefined) {
      message = lockAttendance ? `Attendance locked for ${month}/${year}` : `Attendance unlocked for ${month}/${year}`;
    }
    if (lockPayroll !== undefined) {
      message = lockPayroll ? `Payroll generation locked for ${month}/${year}` : `Payroll generation unlocked for ${month}/${year}`;
    }

    return NextResponse.json({
      success: true,
      data: settings,
      message,
    });
  } catch (error) {
    console.error('Lock attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
