export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/salary/history - Get salary change history
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');

    let targetEmployeeId = user!.employeeDbId;

    if (employeeId && employeeId !== user!.employeeDbId) {
      const salaryPerm = await checkPermission(user!.userId, user!.role, 'salary', 'view');
      if (salaryPerm.allowed && salaryPerm.scope === 'ALL') {
        targetEmployeeId = employeeId;
      }
    }

    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const history = await prisma.salaryHistory.findMany({
      where: { employeeId: targetEmployeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get salary history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
