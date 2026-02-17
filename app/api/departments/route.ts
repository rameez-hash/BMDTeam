export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

// GET /api/departments - List departments
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            employmentStatus: true,
            profileImage: true,
          },
          orderBy: { firstName: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/departments - Create department
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'departments', 'manage');
    if (!perm.allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const body = await request.json();
    const { name, code, description, parentId, headId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: 'Name and code are required' },
        { status: 400 }
      );
    }

    const existing = await prisma.department.findFirst({
      where: { OR: [{ name }, { code }] },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name,
        code,
        description,
        parentId,
        headId,
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.DEPARTMENT_CREATE,
      module: ActivityModules.DEPARTMENT,
      resourceId: department.id,
      description: `Created department: ${name}`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: department,
    }, { status: 201 });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/departments - Update department
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'departments', 'manage');
    if (!perm.allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, code, description, parentId, headId, isActive } = body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId }),
        ...(headId !== undefined && { headId }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.DEPARTMENT_UPDATE,
      module: ActivityModules.DEPARTMENT,
      resourceId: department.id,
      description: `Updated department: ${department.name}`,
      request,
    });

    return NextResponse.json({ success: true, data: department });
  } catch (error) {
    console.error('Update department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/departments - Delete department
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'departments', 'manage');
    if (!perm.allowed) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Department ID required' }, { status: 400 });
    }

    // Check if department has employees
    const employeeCount = await prisma.employee.count({ where: { departmentId: id } });
    if (employeeCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete department with ${employeeCount} employees. Please reassign them first.` },
        { status: 400 }
      );
    }

    // Soft delete - set isActive to false
    const department = await prisma.department.update({
      where: { id },
      data: { isActive: false },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.DEPARTMENT_DELETE,
      module: ActivityModules.DEPARTMENT,
      resourceId: id,
      description: `Deleted department: ${department.name}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    console.error('Delete department error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
