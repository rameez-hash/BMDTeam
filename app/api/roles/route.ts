import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission, syncPermissionsToDb } from '@/lib/permissions';

// GET /api/roles - List all roles
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'view');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Auto-sync permission definitions to DB
    await syncPermissionsToDb();

    const roles = await prisma.appRole.findMany({
      where: { isActive: true },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { name, description, color, permissions } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.appRole.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'A role with this name already exists' }, { status: 409 });
    }

    const role = await prisma.appRole.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6B7280',
      },
    });

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const permRecords = permissions.map((p: { permissionId: string; scope: string }) => ({
        roleId: role.id,
        permissionId: p.permissionId,
        scope: (p.scope || 'SELF') as 'ALL' | 'DEPARTMENT' | 'SELF',
      }));

      await prisma.rolePermission.createMany({ data: permRecords });
    }

    const fullRole = await prisma.appRole.findUnique({
      where: { id: role.id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { employees: true } },
      },
    });

    return NextResponse.json({ success: true, data: fullRole }, { status: 201 });
  } catch (error) {
    console.error('Create role error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
