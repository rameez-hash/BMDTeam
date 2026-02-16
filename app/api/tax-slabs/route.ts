import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

// GET /api/tax-slabs - List tax slabs
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || new Date().getFullYear();

    const taxSlabs = await prisma.taxSlab.findMany({
      where: {
        year: parseInt(String(year)),
        isActive: true,
      },
      orderBy: { minIncome: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: taxSlabs,
    });
  } catch (error) {
    console.error('Get tax slabs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/tax-slabs - Create tax slab (Admin only)
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'settings', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, minIncome, maxIncome, fixedTax, taxRate, year } = body;

    if (!name || minIncome === undefined || taxRate === undefined || !year) {
      return NextResponse.json(
        { error: 'Name, minimum income, tax rate, and year are required' },
        { status: 400 }
      );
    }

    const taxSlab = await prisma.taxSlab.create({
      data: {
        name,
        minIncome,
        maxIncome,
        fixedTax: fixedTax || 0,
        taxRate,
        year,
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.TAX_SLAB_CREATE,
      module: ActivityModules.TAX_SLAB,
      resourceId: taxSlab.id,
      description: `Created tax slab: ${name} (${taxRate}%)`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: taxSlab,
    }, { status: 201 });
  } catch (error) {
    console.error('Create tax slab error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/tax-slabs - Update tax slab
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
      return NextResponse.json({ error: 'Tax slab ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, minIncome, maxIncome, fixedTax, taxRate, year, isActive } = body;

    const taxSlab = await prisma.taxSlab.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(minIncome !== undefined && { minIncome }),
        ...(maxIncome !== undefined && { maxIncome }),
        ...(fixedTax !== undefined && { fixedTax }),
        ...(taxRate !== undefined && { taxRate }),
        ...(year !== undefined && { year }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.TAX_SLAB_UPDATE,
      module: ActivityModules.TAX_SLAB,
      resourceId: taxSlab.id,
      description: `Updated tax slab: ${taxSlab.name}`,
      request,
    });

    return NextResponse.json({ success: true, data: taxSlab });
  } catch (error) {
    console.error('Update tax slab error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/tax-slabs - Delete tax slab
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
      return NextResponse.json({ error: 'Tax slab ID required' }, { status: 400 });
    }

    const taxSlab = await prisma.taxSlab.update({
      where: { id },
      data: { isActive: false },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.TAX_SLAB_DELETE,
      module: ActivityModules.TAX_SLAB,
      resourceId: id,
      description: `Deleted tax slab: ${taxSlab.name}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Tax slab deleted' });
  } catch (error) {
    console.error('Delete tax slab error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
