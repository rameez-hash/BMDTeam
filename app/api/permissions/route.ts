export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission, ALL_PERMISSIONS, PERMISSION_MODULES, syncPermissionsToDb } from '@/lib/permissions';

// GET /api/permissions - List all permissions (and modules)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    // Auto-sync permission definitions to DB (creates missing records)
    await syncPermissionsToDb();

    // Get all permissions from database
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      data: permissions,
      modules: PERMISSION_MODULES,
      definitions: ALL_PERMISSIONS,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/permissions/employee - Assign permissions to an employee
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { employeeId, permissions } = await request.json();

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing individual permissions
      await tx.employeePermission.deleteMany({ where: { employeeId } });

      // Create new individual permissions
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        const permRecords = permissions.map((p: { permissionId: string; scope: string; granted?: boolean }) => ({
          employeeId,
          permissionId: p.permissionId,
          scope: (p.scope || 'SELF') as 'ALL' | 'DEPARTMENT' | 'SELF',
          granted: p.granted !== false,
        }));
        await tx.employeePermission.createMany({ data: permRecords });
      }
    });

    // Return updated employee permissions
    const updated = await prisma.employeePermission.findMany({
      where: { employeeId },
      include: { permission: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Assign permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
