export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

/**
 * POST /api/leave/calculate-balance
 * Calculate and allocate leave balance based on proration
 * 
 * Body:
 * - employeeId: string (optional — omit to calculate for ALL active employees)
 * - leaveTypeId: string (optional, if not provided calculate for all leave types)
 * - year: number (optional, defaults to current year)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, leaveTypeId, year } = body;
    const targetYear = year || new Date().getFullYear();

    // Get leave types to process
    const leaveTypes = leaveTypeId
      ? await prisma.leaveType.findMany({ where: { id: leaveTypeId, isActive: true } })
      : await prisma.leaveType.findMany({ where: { isActive: true } });

    if (leaveTypes.length === 0) {
      return NextResponse.json({ error: 'No active leave types found' }, { status: 404 });
    }

    // Determine employees to process
    let employees;
    if (employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      employees = [emp];
    } else {
      employees = await prisma.employee.findMany({
        where: { employmentStatus: 'ACTIVE' },
      });
    }

    let totalCreated = 0;
    let totalUpdated = 0;

    for (const employee of employees) {
      for (const lt of leaveTypes) {
        let totalDays = lt.annualAllocation || 0;

        if (lt.isProratedOnJoin) {
          const refDate = employee.confirmationDate || employee.joiningDate;
          if (refDate) {
            const ref = new Date(refDate);
            const refYear = ref.getFullYear();
            if (refYear === targetYear) {
              // Month-wise proration: include joining month
              const refMonth = ref.getMonth() + 1; // 1-indexed
              const monthsRemaining = 12 - refMonth + 1;
              totalDays = Math.round((lt.annualAllocation / 12) * monthsRemaining);
            } else if (refYear > targetYear) {
              totalDays = 0;
            }
            // If refYear < targetYear, employee gets full annual allocation
          }
        }

        // Check carry forward from previous year
        let carryForward = 0;
        if (lt.isCarryForward) {
          const prevBalance = await prisma.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: employee.id,
                leaveTypeId: lt.id,
                year: targetYear - 1,
              },
            },
          });
          if (prevBalance) {
            const remaining = prevBalance.totalDays - prevBalance.usedDays - prevBalance.pendingDays;
            carryForward = Math.min(Math.max(remaining, 0), lt.maxCarryForward || 0);
          }
        }

        const existing = await prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: employee.id,
              leaveTypeId: lt.id,
              year: targetYear,
            },
          },
        });

        if (existing) {
          // Skip manually-set balances to preserve admin edits
          if (!existing.isAutoCalculated) {
            continue;
          }
          await prisma.leaveBalance.update({
            where: { id: existing.id },
            data: {
              totalDays: totalDays + carryForward,
              carryForward,
              isAutoCalculated: true,
            },
          });
          totalUpdated++;
        } else {
          await prisma.leaveBalance.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: lt.id,
              year: targetYear,
              totalDays: totalDays + carryForward,
              carryForward,
              usedDays: 0,
              pendingDays: 0,
              isAutoCalculated: true,
            },
          });
          totalCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: employeeId
        ? 'Leave balance calculated successfully'
        : `Calculated for ${employees.length} employees (${totalCreated} created, ${totalUpdated} updated)`,
      data: { created: totalCreated, updated: totalUpdated, employees: employees.length },
    });
  } catch (error) {
    console.error('Calculate balance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
