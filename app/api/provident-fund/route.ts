export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/provident-fund - List PF contributions
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const year = searchParams.get('year');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    const viewPerm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');
    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      // Employees can only see their own PF
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId }, select: { id: true } });
      where.employeeId = emp?.id;
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const currentEmp = await prisma.employee.findUnique({ where: { userId: user!.userId }, select: { departmentId: true } });
      if (employeeId) {
        where.employeeId = employeeId;
        where.employee = { departmentId: currentEmp?.departmentId };
      } else {
        where.employee = { departmentId: currentEmp?.departmentId };
      }
    } else {
      // ALL scope
      if (employeeId) {
        where.employeeId = employeeId;
      }
    }

    if (year) {
      where.year = parseInt(year);
    }

    const [contributions, total] = await Promise.all([
      prisma.pFContribution.findMany({
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
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      prisma.pFContribution.count({ where }),
    ]);

    // Calculate summary
    const summary = await prisma.pFContribution.aggregate({
      where,
      _sum: {
        employeeContribution: true,
        employerContribution: true,
        totalContribution: true,
      },
    });

    // Get per-employee balances (latest running balance per employee)
    let employeeBalances: Array<{
      employeeId: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      department: string;
      totalEmployee: number;
      totalEmployer: number;
      totalBalance: number;
      pfEnabled: boolean;
      monthsContributed: number;
    }> = [];

    if (!employeeId) {
      // Get all employees with PF enabled (salary.pf > 0)
      const employeesWithPF = await prisma.employee.findMany({
        where: {
          employmentStatus: 'ACTIVE',
          salary: { pf: { gt: 0 } },
          user: { role: { not: 'ADMIN' } },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          department: { select: { name: true } },
          salary: { select: { pf: true, basicSalary: true } },
          pfContributions: {
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 1,
            select: { runningBalance: true },
          },
          _count: { select: { pfContributions: true } },
        },
      });

      employeeBalances = employeesWithPF.map(emp => ({
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeCode: emp.employeeCode,
        department: emp.department?.name || '-',
        totalEmployee: 0,
        totalEmployer: 0,
        totalBalance: emp.pfContributions[0]?.runningBalance || 0,
        pfEnabled: (emp.salary?.pf || 0) > 0,
        monthsContributed: emp._count.pfContributions,
      }));

      // Get aggregate per employee
      const perEmployeeAgg = await prisma.pFContribution.groupBy({
        by: ['employeeId'],
        where: year ? { year: parseInt(year) } : undefined,
        _sum: {
          employeeContribution: true,
          employerContribution: true,
        },
      });

      for (const agg of perEmployeeAgg) {
        const found = employeeBalances.find(e => e.employeeId === agg.employeeId);
        if (found) {
          found.totalEmployee = agg._sum.employeeContribution || 0;
          found.totalEmployer = agg._sum.employerContribution || 0;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: contributions,
      employeeBalances,
      summary: {
        totalEmployeeContribution: summary._sum.employeeContribution || 0,
        totalEmployerContribution: summary._sum.employerContribution || 0,
        totalContribution: summary._sum.totalContribution || 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get PF contributions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
