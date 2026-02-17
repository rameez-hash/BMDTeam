export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/leave/balance - Get leave balance (auto-initializes if missing)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Determine which employee to get balance for
    let targetEmployeeId = user!.employeeDbId;
    
    if (employeeId) {
      const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
      if (perm.allowed) {
        targetEmployeeId = employeeId;
      }
    }

    if (!targetEmployeeId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get existing balances
    let balances = await prisma.leaveBalance.findMany({
      where: { employeeId: targetEmployeeId, year },
      include: { leaveType: true },
    });

    // Auto-initialize: if no balances exist for this year, calculate them
    if (balances.length === 0) {
      const leaveTypes = await prisma.leaveType.findMany({ where: { isActive: true } });
      
      if (leaveTypes.length > 0) {
        const employee = await prisma.employee.findUnique({
          where: { id: targetEmployeeId },
          select: { confirmationDate: true, joiningDate: true },
        });

        for (const lt of leaveTypes) {
          const totalDays = calculateProratedDays(lt, employee, year);
          
          // Check carry forward from previous year
          let carryForward = 0;
          if (lt.isCarryForward) {
            const prevBalance = await prisma.leaveBalance.findUnique({
              where: {
                employeeId_leaveTypeId_year: {
                  employeeId: targetEmployeeId,
                  leaveTypeId: lt.id,
                  year: year - 1,
                },
              },
            });
            if (prevBalance) {
              const remaining = prevBalance.totalDays - prevBalance.usedDays - prevBalance.pendingDays;
              carryForward = Math.min(Math.max(remaining, 0), lt.maxCarryForward || 0);
            }
          }

          await prisma.leaveBalance.create({
            data: {
              employeeId: targetEmployeeId,
              leaveTypeId: lt.id,
              year,
              totalDays: totalDays + carryForward,
              carryForward,
              usedDays: 0,
              pendingDays: 0,
              isAutoCalculated: true,
            },
          });
        }

        // Re-fetch after creation
        balances = await prisma.leaveBalance.findMany({
          where: { employeeId: targetEmployeeId, year },
          include: { leaveType: true },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: balances.map(b => ({
        id: b.id,
        leaveType: b.leaveType.name,
        leaveTypeId: b.leaveTypeId,
        leaveTypeCode: b.leaveType.code,
        annualAllocation: b.leaveType.annualAllocation,
        isPaid: b.leaveType.isPaid,
        totalDays: b.totalDays,
        usedDays: b.usedDays,
        pendingDays: b.pendingDays,
        remainingDays: b.totalDays - b.usedDays - b.pendingDays,
        carryForward: b.carryForward,
        isAutoCalculated: b.isAutoCalculated,
      })),
    });
  } catch (error) {
    console.error('Get leave balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/leave/balance - Manual set or adjust balance
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employeeId,
      leaveTypeId,
      year,
      totalDays,       // Set exact total
      adjustDays,      // Add (+) or subtract (-) from current total
      carryForward,
      usedDays,
      pendingDays,
    } = body;

    if (!employeeId || !leaveTypeId) {
      return NextResponse.json({ error: 'Employee and leave type are required' }, { status: 400 });
    }

    const targetYear = Number.isFinite(year) ? year : new Date().getFullYear();

    // If adjustDays is provided, add/subtract from existing balance
    if (adjustDays !== undefined && adjustDays !== 0) {
      const existing = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: targetYear },
        },
      });

      if (!existing) {
        return NextResponse.json({ error: 'No existing balance to adjust. Set total first.' }, { status: 400 });
      }

      const newTotal = Math.max(0, existing.totalDays + parseFloat(adjustDays));
      const balance = await prisma.leaveBalance.update({
        where: { id: existing.id },
        data: { totalDays: newTotal, isAutoCalculated: false },
        include: { leaveType: true },
      });

      return NextResponse.json({
        success: true,
        message: `Adjusted by ${adjustDays > 0 ? '+' : ''}${adjustDays} days. New total: ${newTotal}`,
        data: balance,
      });
    }

    // Otherwise upsert with exact values
    if (totalDays === undefined) {
      return NextResponse.json({ error: 'Provide totalDays or adjustDays' }, { status: 400 });
    }

    const updateData: Record<string, number | boolean> = {
      totalDays: parseFloat(totalDays),
      isAutoCalculated: false,
    };
    if (carryForward !== undefined) updateData.carryForward = parseFloat(carryForward);
    if (usedDays !== undefined) updateData.usedDays = parseFloat(usedDays);
    if (pendingDays !== undefined) updateData.pendingDays = parseFloat(pendingDays);

    const balance = await prisma.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: targetYear },
      },
      update: updateData,
      create: {
        employeeId,
        leaveTypeId,
        year: targetYear,
        totalDays: parseFloat(totalDays),
        carryForward: carryForward ? parseFloat(carryForward) : 0,
        usedDays: usedDays ? parseFloat(usedDays) : 0,
        pendingDays: pendingDays ? parseFloat(pendingDays) : 0,
        isAutoCalculated: false,
      },
      include: { leaveType: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Leave balance updated',
      data: balance,
    });
  } catch (error) {
    console.error('Manual leave balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper: Calculate prorated days based on joining/confirmation date
function calculateProratedDays(
  leaveType: { annualAllocation: number; isProratedOnJoin: boolean },
  employee: { confirmationDate: Date | null; joiningDate: Date | null } | null,
  year: number
): number {
  const annual = leaveType.annualAllocation || 0;
  if (!annual) return 0;
  if (!leaveType.isProratedOnJoin || !employee) return annual;

  const referenceDate = employee.confirmationDate || employee.joiningDate;
  if (!referenceDate) return annual;

  const refDate = new Date(referenceDate);
  const refYear = refDate.getFullYear();

  if (refYear < year) return annual;
  if (refYear > year) return 0;

  // Same year: prorate by remaining months (including joining month)
  const refMonth = refDate.getMonth() + 1;
  const monthsRemaining = 12 - refMonth + 1;
  return Math.round((annual / 12) * monthsRemaining);
}
