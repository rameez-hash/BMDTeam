export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { calculatePayrollTotals, num } from '@/lib/payroll-totals';

const employeeInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { id: true, name: true } },
    },
  },
  manualDeductions: true,
};

function parseManualBody(body: Record<string, unknown>) {
  const employeeId = body.employeeId as string;
  const month = parseInt(String(body.month), 10);
  const year = parseInt(String(body.year), 10);

  const amounts: Parameters<typeof calculatePayrollTotals>[0] = {
    basicSalary: num(body.basicSalary),
    hra: num(body.hra),
    da: num(body.da),
    ta: num(body.ta),
    medicalAllowance: num(body.medicalAllowance),
    otherAllowances: num(body.otherAllowances),
    overtime: num(body.overtime),
    bonus: num(body.bonus),
    pf: num(body.pf),
    esi: num(body.esi),
    professionalTax: num(body.professionalTax),
    tds: num(body.tds),
    lateDeduction: num(body.lateDeduction),
    absentDeduction: num(body.absentDeduction),
    otherDeductions: num(body.otherDeductions),
    manualDeduction: num(body.manualDeduction),
  };

  const totals = calculatePayrollTotals(amounts);

  return {
    employeeId,
    month,
    year,
    workingDays: Math.max(0, Math.round(num(body.workingDays))),
    presentDays: Math.max(0, num(body.presentDays)),
    leaveDays: Math.max(0, num(body.leaveDays)),
    absentDays: Math.max(0, num(body.absentDays)),
    halfDays: Math.max(0, Math.round(num(body.halfDays))),
    lateDays: Math.max(0, Math.round(num(body.lateDays))),
    ...amounts,
    ...totals,
    notes: typeof body.notes === 'string' ? body.notes : null,
    deductionReason: typeof body.deductionReason === 'string' ? body.deductionReason : null,
    paymentReference: typeof body.paymentReference === 'string' ? body.paymentReference : null,
    status: (body.status as string) || 'DRAFT',
    paidAt: body.paidAt ? new Date(String(body.paidAt)) : null,
  };
}

// POST /api/payroll/manual — create manual payslip (historical / pre-HRMS)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const data = parseManualBody(body);

    if (!data.employeeId || !data.month || !data.year) {
      return NextResponse.json({ error: 'Employee, month, and year are required' }, { status: 400 });
    }

    const existing = await prisma.payrollRecord.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: data.employeeId,
          month: data.month,
          year: data.year,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `Payroll for this employee already exists for ${data.month}/${data.year}. Edit the existing record or delete it first.`,
          existingId: existing.id,
          isManual: existing.isManual,
        },
        { status: 409 }
      );
    }

    const defaultNotes =
      data.notes ||
      'Manual entry — entered outside auto payroll (e.g. pre-HRMS month)';

    const record = await prisma.payrollRecord.create({
      data: {
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
        workingDays: data.workingDays,
        presentDays: data.presentDays,
        leaveDays: data.leaveDays,
        absentDays: data.absentDays,
        halfDays: data.halfDays,
        lateDays: data.lateDays,
        basicSalary: data.basicSalary,
        hra: data.hra,
        da: data.da,
        ta: data.ta,
        medicalAllowance: data.medicalAllowance,
        otherAllowances: data.otherAllowances,
        overtime: data.overtime,
        bonus: data.bonus,
        pf: data.pf,
        esi: data.esi,
        professionalTax: data.professionalTax,
        tds: data.tds,
        lateDeduction: data.lateDeduction,
        absentDeduction: data.absentDeduction,
        otherDeductions: data.otherDeductions,
        manualDeduction: data.manualDeduction,
        deductionReason: data.deductionReason,
        notes: defaultNotes,
        paymentReference: data.paymentReference,
        grossEarnings: data.grossEarnings,
        totalDeductions: data.totalDeductions,
        netSalary: data.netSalary,
        status: data.status === 'PAID' ? 'PAID' : data.status === 'PROCESSED' ? 'PROCESSED' : 'DRAFT',
        isManual: true,
        paidAt: data.status === 'PAID' ? data.paidAt || new Date() : null,
      },
      include: employeeInclude,
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.PAYROLL_UPDATE,
      module: ActivityModules.PAYROLL,
      resourceId: record.id,
      description: `Created manual payroll for ${record.employee.firstName} ${record.employee.lastName} (${data.month}/${data.year})`,
      request,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Manual payroll create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/payroll/manual — update manual payslip (full fields)
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const id = body.id as string;
    if (!id) {
      return NextResponse.json({ error: 'Payroll record ID required' }, { status: 400 });
    }

    const existing = await prisma.payrollRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
    }
    if (!existing.isManual) {
      return NextResponse.json(
        { error: 'Only manual payroll records can be fully edited here. Auto-generated records use Generate Payroll.' },
        { status: 400 }
      );
    }
    const data = parseManualBody({ ...body, employeeId: existing.employeeId, month: existing.month, year: existing.year });

    const record = await prisma.payrollRecord.update({
      where: { id },
      data: {
        workingDays: data.workingDays,
        presentDays: data.presentDays,
        leaveDays: data.leaveDays,
        absentDays: data.absentDays,
        halfDays: data.halfDays,
        lateDays: data.lateDays,
        basicSalary: data.basicSalary,
        hra: data.hra,
        da: data.da,
        ta: data.ta,
        medicalAllowance: data.medicalAllowance,
        otherAllowances: data.otherAllowances,
        overtime: data.overtime,
        bonus: data.bonus,
        pf: data.pf,
        esi: data.esi,
        professionalTax: data.professionalTax,
        tds: data.tds,
        lateDeduction: data.lateDeduction,
        absentDeduction: data.absentDeduction,
        otherDeductions: data.otherDeductions,
        manualDeduction: data.manualDeduction,
        deductionReason: data.deductionReason,
        notes: data.notes ?? existing.notes,
        paymentReference: data.paymentReference,
        grossEarnings: data.grossEarnings,
        totalDeductions: data.totalDeductions,
        netSalary: data.netSalary,
        status: data.status === 'PAID' ? 'PAID' : data.status === 'PROCESSED' ? 'PROCESSED' : data.status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
        paidAt: data.status === 'PAID' ? data.paidAt || existing.paidAt || new Date() : data.status === 'DRAFT' ? null : existing.paidAt,
      },
      include: employeeInclude,
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.PAYROLL_UPDATE,
      module: ActivityModules.PAYROLL,
      resourceId: id,
      description: `Updated manual payroll for ${record.employee.firstName} ${record.employee.lastName}`,
      request,
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Manual payroll update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
