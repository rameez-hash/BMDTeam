export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import {
  getCurrentFinancialYear,
  parseFinancialYear,
  payrollFinancialYearFilter,
  MONTH_NAMES,
} from '@/lib/financial-year';

const employeeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  employeeCode: true,
  panNumber: true,
  department: { select: { name: true } },
};

// GET /api/payroll/tax-records?financialYear=2025-2026&departmentId=
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const viewPerm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');

    const searchParams = request.nextUrl.searchParams;
    const financialYear = searchParams.get('financialYear') || getCurrentFinancialYear();
    const departmentId = searchParams.get('departmentId') || '';
    const employeeId = searchParams.get('employeeId') || '';

    const fyFilter = payrollFinancialYearFilter(financialYear);
    if (!fyFilter) {
      return NextResponse.json({ error: 'Invalid financial year (use e.g. 2025-2026)' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      ...fyFilter,
      status: { in: ['PAID', 'PROCESSED', 'DRAFT'] },
      tds: { gt: 0 },
    };

    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      where.employee = { userId: user!.userId };
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const currentEmp = await prisma.employee.findUnique({
        where: { userId: user!.userId },
        select: { departmentId: true },
      });
      where.employee = { departmentId: currentEmp?.departmentId };
    } else {
      if (employeeId) where.employeeId = employeeId;
      else if (departmentId) where.employee = { departmentId };
    }

    const records = await prisma.payrollRecord.findMany({
      where,
      include: { employee: { select: employeeSelect } },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    type MonthRow = {
      month: number;
      year: number;
      monthLabel: string;
      grossEarnings: number;
      tds: number;
      netSalary: number;
      status: string;
      payrollId: string;
    };

    type EmpAgg = {
      employeeId: string;
      employee: (typeof records)[0]['employee'];
      months: MonthRow[];
      totalGross: number;
      totalTax: number;
      monthCount: number;
    };

    const byEmployee = new Map<string, EmpAgg>();

    for (const r of records) {
      let agg = byEmployee.get(r.employeeId);
      if (!agg) {
        agg = {
          employeeId: r.employeeId,
          employee: r.employee,
          months: [],
          totalGross: 0,
          totalTax: 0,
          monthCount: 0,
        };
        byEmployee.set(r.employeeId, agg);
      }
      agg.months.push({
        month: r.month,
        year: r.year,
        monthLabel: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
        grossEarnings: r.grossEarnings,
        tds: r.tds,
        netSalary: r.netSalary,
        status: r.status,
        payrollId: r.id,
      });
      agg.totalGross += r.grossEarnings;
      agg.totalTax += r.tds;
      agg.monthCount += 1;
    }

    const data = Array.from(byEmployee.values()).sort((a, b) =>
      `${a.employee.firstName} ${a.employee.lastName}`.localeCompare(
        `${b.employee.firstName} ${b.employee.lastName}`
      )
    );

    const parsed = parseFinancialYear(financialYear)!;

    return NextResponse.json({
      success: true,
      financialYear,
      periodLabel: `July ${parsed.startYear} – June ${parsed.endYear}`,
      data,
      summary: {
        employees: data.length,
        totalTaxWithheld: data.reduce((s, e) => s + e.totalTax, 0),
        totalGross: data.reduce((s, e) => s + e.totalGross, 0),
      },
    });
  } catch (err) {
    console.error('Tax records error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
