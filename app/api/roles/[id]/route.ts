export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/roles/[id] - Get single role with permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'view');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const role = await prisma.appRole.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { employees: true } },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: role });
  } catch (error) {
    console.error('Get role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const { name, description, color, permissions } = await request.json();

    const existing = await prisma.appRole.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Check for duplicate name
    if (name) {
      const dup = await prisma.appRole.findFirst({
        where: { name: name.trim(), id: { not: id } },
      });
      if (dup) {
        return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
      }
    }

    await prisma.$transaction(async (tx) => {
      // Update role details
      await tx.appRole.update({
        where: { id },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(color && { color }),
        },
      });

      // Update permissions if provided
      if (permissions !== undefined && Array.isArray(permissions)) {
        // Delete all existing role permissions
        await tx.rolePermission.deleteMany({ where: { roleId: id } });

        // Create new ones
        if (permissions.length > 0) {
          const permRecords = permissions.map((p: { permissionId: string; scope: string }) => ({
            roleId: id,
            permissionId: p.permissionId,
            scope: (p.scope || 'SELF') as 'ALL' | 'DEPARTMENT' | 'SELF',
          }));
          await tx.rolePermission.createMany({ data: permRecords });
        }
      }
    });

    const updatedRole = await prisma.appRole.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ success: true, data: updatedRole });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/roles/[id] - Delete role
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const role = await prisma.appRole.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    if (role.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 400 });
    }

    if (role._count.employees > 0) {
      return NextResponse.json(
        { error: `Cannot delete role. ${role._count.employees} employee(s) are assigned to this role. Please reassign them first.` },
        { status: 400 }
      );
    }

    await prisma.appRole.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
