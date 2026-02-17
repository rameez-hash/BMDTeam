export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const data = await request.json();
    const { employeeId, financialYear } = data;

    if (!employeeId || !financialYear) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check permission: employees can only view their own
    const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
    if (employeeId !== emp?.id) {
      const perm = await checkPermission(user!.userId, user!.role, 'salary', 'manage');
      if (!perm.allowed) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    // Fetch all salaries for the employee in the financial year
    const startDate = new Date(`${financialYear}-04-01`);
    const endDate = new Date(`${parseInt(financialYear) + 1}-03-31`);

    const salaries = await prisma.salary.findMany({
      where: {
        employeeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (salaries.length === 0) {
      return NextResponse.json(
        { error: 'No salary records found for the specified financial year' },
        { status: 404 }
      );
    }

    // Calculate totals
    let totalIncome = 0;
    let totalTax = 0;
    let totalDeductions = 0;

    salaries.forEach((salary) => {
      const allowances = salary.hra + salary.da + salary.ta + salary.medicalAllowance + salary.otherAllowances;
      totalIncome += salary.basicSalary + allowances;
      totalTax += salary.tds || 0;
      totalDeductions += (salary.otherDeductions || 0) + (salary.tds || 0);
    });

    // Get or create tax certificate
    let certificate = await prisma.taxCertificate.findFirst({
      where: {
        employeeId,
        financialYear,
      },
    });

    if (!certificate) {
      certificate = await prisma.taxCertificate.create({
        data: {
          employeeId,
          financialYear,
          totalIncome,
          totalTaxPaid: totalTax,
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
              panNumber: true,
            },
          },
        },
      });
    } else {
      // Update existing certificate
      certificate = await prisma.taxCertificate.update({
        where: { id: certificate.id },
        data: {
          totalIncome,
          totalTaxPaid: totalTax,
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              employeeCode: true,
              panNumber: true,
            },
          },
        },
      });
    }

    return NextResponse.json({
      certificate,
      salaryCount: salaries.length,
      summary: {
        totalIncome,
        totalTax,
        totalDeductions,
        netIncome: totalIncome - totalDeductions,
      },
    });
  } catch (error) {
    console.error('Tax certificate error:', error);
    return NextResponse.json(
      { error: 'Failed to generate tax certificate' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing employeeId' },
        { status: 400 }
      );
    }

    // Check permission: employees can only view their own
    const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
    if (employeeId !== emp?.id) {
      const perm = await checkPermission(user!.userId, user!.role, 'salary', 'view');
      if (!perm.allowed || perm.scope === 'SELF') {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const certificates = await prisma.taxCertificate.findMany({
      where: { employeeId },
      orderBy: { financialYear: 'desc' },
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            employeeCode: true,
            panNumber: true,
          },
        },
      },
    });

    return NextResponse.json(certificates);
  } catch (error) {
    console.error('Fetch certificates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax certificates' },
      { status: 500 }
    );
  }
}
