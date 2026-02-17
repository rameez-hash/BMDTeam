export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/leave/types - List leave types
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: leaveTypes,
    });
  } catch (error) {
    console.error('Get leave types error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/leave/types - Create leave type
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, description, annualAllocation, isProratedOnJoin, isCarryForward, maxCarryForward, isPaid } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    const existingType = await prisma.leaveType.findFirst({
      where: { OR: [{ name }, { code }] },
    });

    if (existingType) {
      return NextResponse.json(
        { error: 'Leave type with this name or code already exists' },
        { status: 409 }
      );
    }

    const leaveType = await prisma.leaveType.create({
      data: {
        name,
        code,
        description,
        annualAllocation: annualAllocation || 0,
        isProratedOnJoin: isProratedOnJoin !== false,
        isCarryForward: isCarryForward || false,
        maxCarryForward: maxCarryForward || 0,
        isPaid: isPaid !== false,
      },
    });

    return NextResponse.json({
      success: true,
      data: leaveType,
    }, { status: 201 });
  } catch (error) {
    console.error('Create leave type error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/leave/types - Update leave type
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Leave type ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, annualAllocation, isProratedOnJoin, isCarryForward, maxCarryForward, isPaid, isActive } = body;

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(annualAllocation !== undefined && { annualAllocation }),
        ...(isProratedOnJoin !== undefined && { isProratedOnJoin }),
        ...(isCarryForward !== undefined && { isCarryForward }),
        ...(maxCarryForward !== undefined && { maxCarryForward }),
        ...(isPaid !== undefined && { isPaid }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, data: leaveType });
  } catch (error) {
    console.error('Update leave type error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/leave/types - Delete leave type
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'leave', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Leave type ID required' }, { status: 400 });
    }

    // Soft delete
    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true, message: 'Leave type deleted' });
  } catch (error) {
    console.error('Delete leave type error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
