export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// POST /api/payroll/deductions - Add manual deduction
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { payrollRecordId, label, amount, reason } = body;

    if (!payrollRecordId || !label || amount === undefined) {
      return NextResponse.json(
        { error: 'Payroll record ID, label, and amount are required' },
        { status: 400 }
      );
    }

    // Verify payroll record exists and is not PAID
    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: payrollRecordId },
    });

    if (!payrollRecord) {
      return NextResponse.json(
        { error: 'Payroll record not found' },
        { status: 404 }
      );
    }

    if (payrollRecord.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot add deduction to paid payroll' },
        { status: 400 }
      );
    }

    // Create manual deduction
    const deduction = await prisma.manualDeduction.create({
      data: {
        payrollRecordId,
        label,
        amount: parseFloat(amount.toString()),
        reason,
      },
    });

    // Recalculate payroll totals
    const allDeductions = await prisma.manualDeduction.findMany({
      where: { payrollRecordId },
    });

    const totalManualDeductions = allDeductions.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);

    const newTotalDeductions = 
      payrollRecord.pf +
      payrollRecord.esi +
      payrollRecord.professionalTax +
      payrollRecord.tds +
      payrollRecord.lateDeduction +
      payrollRecord.absentDeduction +
      payrollRecord.otherDeductions +
      totalManualDeductions;

    const newNetSalary = Math.max(0, payrollRecord.grossEarnings - newTotalDeductions);

    await prisma.payrollRecord.update({
      where: { id: payrollRecordId },
      data: {
        manualDeduction: totalManualDeductions,
        totalDeductions: newTotalDeductions,
        netSalary: newNetSalary,
      },
    });

    return NextResponse.json({
      success: true,
      data: deduction,
      message: 'Deduction added successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Add manual deduction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/payroll/deductions - Get manual deductions for a payroll record
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const payrollRecordId = searchParams.get('payrollRecordId');

    if (!payrollRecordId) {
      return NextResponse.json(
        { error: 'Payroll record ID required' },
        { status: 400 }
      );
    }

    const deductions = await prisma.manualDeduction.findMany({
      where: { payrollRecordId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: deductions,
    });
  } catch (error) {
    console.error('Get deductions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/payroll/deductions - Remove manual deduction
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Deduction ID required' },
        { status: 400 }
      );
    }

    const deduction = await prisma.manualDeduction.findUnique({
      where: { id },
      include: { payrollRecord: true },
    });

    if (!deduction) {
      return NextResponse.json(
        { error: 'Deduction not found' },
        { status: 404 }
      );
    }

    if (deduction.payrollRecord.status === 'PAID') {
      return NextResponse.json(
        { error: 'Cannot remove deduction from paid payroll' },
        { status: 400 }
      );
    }

    // Delete the deduction
    await prisma.manualDeduction.delete({ where: { id } });

    // Recalculate payroll totals
    const remainingDeductions = await prisma.manualDeduction.findMany({
      where: { payrollRecordId: deduction.payrollRecordId },
    });

    const totalManualDeductions = remainingDeductions.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
    const payrollRecord = deduction.payrollRecord;

    const newTotalDeductions = 
      payrollRecord.pf +
      payrollRecord.esi +
      payrollRecord.professionalTax +
      payrollRecord.tds +
      payrollRecord.lateDeduction +
      payrollRecord.absentDeduction +
      payrollRecord.otherDeductions +
      totalManualDeductions;

    const newNetSalary = Math.max(0, payrollRecord.grossEarnings - newTotalDeductions);

    await prisma.payrollRecord.update({
      where: { id: deduction.payrollRecordId },
      data: {
        manualDeduction: totalManualDeductions,
        totalDeductions: newTotalDeductions,
        netSalary: newNetSalary,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Deduction removed successfully',
    });
  } catch (error) {
    console.error('Remove deduction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
