import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/employees/[id]/permissions - Get employee's effective permissions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    // Check permission - need at least roles:view to see employee permissions
    const perm = await checkPermission(user!.userId, user!.role, 'roles', 'view');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        appRole: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
        employeePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Role permissions
    const rolePermissions = employee.appRole?.permissions.map(rp => ({
      id: rp.permission.id,
      module: rp.permission.module,
      action: rp.permission.action,
      label: rp.permission.label,
      scope: rp.scope,
      source: 'role' as const,
    })) || [];

    // Individual permissions (overrides)
    const individualPermissions = employee.employeePermissions.map(ep => ({
      id: ep.permission.id,
      module: ep.permission.module,
      action: ep.permission.action,
      label: ep.permission.label,
      scope: ep.scope,
      granted: ep.granted,
      source: 'individual' as const,
    }));

    return NextResponse.json({
      success: true,
      data: {
        roleId: employee.appRoleId,
        roleName: employee.appRole?.name || null,
        rolePermissions,
        individualPermissions,
      },
    });
  } catch (error) {
    console.error('Get employee permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/employees/[id]/permissions - Update employee permissions
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
    const { appRoleId, permissions } = await request.json();

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Update role assignment
      await tx.employee.update({
        where: { id },
        data: { appRoleId: appRoleId || null },
      });

      // Update individual permissions
      if (permissions !== undefined && Array.isArray(permissions)) {
        await tx.employeePermission.deleteMany({ where: { employeeId: id } });

        if (permissions.length > 0) {
          const permRecords = permissions.map((p: { permissionId: string; scope: string; granted?: boolean }) => ({
            employeeId: id,
            permissionId: p.permissionId,
            scope: (p.scope || 'SELF') as 'ALL' | 'DEPARTMENT' | 'SELF',
            granted: p.granted !== false,
          }));
          await tx.employeePermission.createMany({ data: permRecords });
        }
      }
    });

    return NextResponse.json({ success: true, message: 'Permissions updated' });
  } catch (error) {
    console.error('Update employee permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
