export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

// GET /api/late-rules - List late arrival rules
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const lateRules = await prisma.lateRule.findMany({
      where: { isActive: true },
      orderBy: { minLateCount: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: lateRules,
    });
  } catch (error) {
    console.error('Get late rules error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/late-rules - Create late rule (Admin only)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'settings', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, minLateCount, maxLateCount, deductionType, deductionValue, deductionDays, description } = body;

    if (!name || minLateCount === undefined || !deductionType || deductionValue === undefined) {
      return NextResponse.json(
        { error: 'Name, minimum late count, deduction type, and deduction value are required' },
        { status: 400 }
      );
    }

    if (!['PERCENTAGE', 'FIXED', 'DAYS', 'PER_LATE_DAYS'].includes(deductionType)) {
      return NextResponse.json(
        { error: 'Invalid deduction type. Must be PERCENTAGE, FIXED, DAYS, or PER_LATE_DAYS' },
        { status: 400 }
      );
    }

    const lateRule = await prisma.lateRule.create({
      data: {
        name,
        minLateCount,
        maxLateCount,
        deductionType,
        deductionValue,
        deductionDays: deductionDays ?? 1,
        description,
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.LATE_RULE_CREATE,
      module: ActivityModules.LATE_RULE,
      resourceId: lateRule.id,
      description: `Created late rule: ${name}`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: lateRule,
    }, { status: 201 });
  } catch (error) {
    console.error('Create late rule error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/late-rules - Update late rule
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'settings', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Late rule ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, minLateCount, maxLateCount, deductionType, deductionValue, deductionDays, description, isActive } = body;

    const lateRule = await prisma.lateRule.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(minLateCount !== undefined && { minLateCount }),
        ...(maxLateCount !== undefined && { maxLateCount }),
        ...(deductionType && { deductionType }),
        ...(deductionValue !== undefined && { deductionValue }),
        ...(deductionDays !== undefined && { deductionDays }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.LATE_RULE_UPDATE,
      module: ActivityModules.LATE_RULE,
      resourceId: lateRule.id,
      description: `Updated late rule: ${lateRule.name}`,
      request,
    });

    return NextResponse.json({ success: true, data: lateRule });
  } catch (error) {
    console.error('Update late rule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/late-rules - Delete late rule
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'settings', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Late rule ID required' }, { status: 400 });
    }

    const lateRule = await prisma.lateRule.update({
      where: { id },
      data: { isActive: false },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.LATE_RULE_DELETE,
      module: ActivityModules.LATE_RULE,
      resourceId: id,
      description: `Deleted late rule: ${lateRule.name}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Late rule deleted' });
  } catch (error) {
    console.error('Delete late rule error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
