import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { hashPassword } from '@/lib/auth';

// GET /api/employees/[id]/credentials - Get employee login info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            employeeId: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        employeeCode: employee.employeeCode,
        email: employee.email,
        role: employee.user?.role,
        isActive: employee.user?.isActive,
        canLogin: employee.user?.isActive,
      },
    });
  } catch (error) {
    console.error('Get employee credentials error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/employees/[id]/credentials - Reset employee password
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');
    if (!editPerm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Update password
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: employee.userId },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        employeeCode: employee.employeeCode,
        email: employee.email,
        newPassword, // Return the new password so admin can share it
      },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
