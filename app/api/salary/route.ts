export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { calculateGrossSalary, calculateTotalDeductions, calculateNetSalary, calculateTax, getPaginationParams } from '@/lib/utils';

// GET /api/salary - List salaries
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const employeeId = searchParams.get('employeeId');

    const where: Record<string, unknown> = {};

    const viewPerm = await checkPermission(user!.userId, user!.role, 'salary', 'view');
    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      where.employee = { userId: user!.userId };
    } else if (employeeId) {
      where.employeeId = employeeId;
    }

    const [salaries, total] = await Promise.all([
      prisma.salary.findMany({
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
              designation: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.salary.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: salaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get salaries error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/salary - Assign/Update salary
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'salary', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employeeId,
      basicSalary,
      hra = 0,
      da = 0,
      ta = 0,
      medicalAllowance = 0,
      otherAllowances = 0,
      pf = 0,
      esi = 0,
      professionalTax = 0,
      tds = 0,
      otherDeductions = 0,
      effectiveFrom,
    } = body;

    if (!employeeId || !basicSalary || !effectiveFrom) {
      return NextResponse.json(
        { error: 'Employee ID, basic salary, and effective date are required' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const grossSalary = calculateGrossSalary({
      basicSalary,
      hra,
      da,
      ta,
      medicalAllowance,
      otherAllowances,
    });

    // Auto-calculate TDS based on tax slabs
    let calculatedTds = tds;
    const taxSlabs = await prisma.taxSlab.findMany({
      where: { isActive: true },
      orderBy: { minIncome: 'asc' }
    });

    if (taxSlabs.length > 0) {
      calculatedTds = calculateTax(grossSalary, taxSlabs);
    }

    const totalDeductions = calculateTotalDeductions({
      pf,
      esi,
      professionalTax,
      tds: calculatedTds,
      otherDeductions,
    });

    const netSalary = calculateNetSalary(grossSalary, totalDeductions);

    // Check if salary exists
    const existingSalary = await prisma.salary.findUnique({
      where: { employeeId },
    });

    let salary;
    let action;

    if (existingSalary) {
      // Save to history
      await prisma.salaryHistory.create({
        data: {
          employeeId,
          basicSalary: existingSalary.basicSalary,
          grossSalary: existingSalary.grossSalary,
          netSalary: existingSalary.netSalary,
          effectiveFrom: existingSalary.effectiveFrom,
          effectiveTo: new Date(effectiveFrom),
          reason: body.reason || 'Salary revision',
        },
      });

      // Update existing
      salary = await prisma.salary.update({
        where: { employeeId },
        data: {
          basicSalary,
          hra,
          da,
          ta,
          medicalAllowance,
          otherAllowances,
          pf,
          esi,
          professionalTax,
          tds: calculatedTds,
          otherDeductions,
          grossSalary,
          netSalary,
          effectiveFrom: new Date(effectiveFrom),
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      });
      action = ActivityActions.SALARY_UPDATE;
    } else {
      // Create new
      salary = await prisma.salary.create({
        data: {
          employeeId,
          basicSalary,
          hra,
          da,
          ta,
          medicalAllowance,
          otherAllowances,
          pf,
          esi,
          professionalTax,
          tds: calculatedTds,
          otherDeductions,
          grossSalary,
          netSalary,
          effectiveFrom: new Date(effectiveFrom),
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      });
      action = ActivityActions.SALARY_ASSIGN;
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action,
      module: ActivityModules.SALARY,
      resourceId: salary.id,
      description: `${existingSalary ? 'Updated' : 'Assigned'} salary for ${salary.employee.firstName} ${salary.employee.lastName}`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: salary,
    }, { status: existingSalary ? 200 : 201 });
  } catch (error) {
    console.error('Assign salary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
