export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

export async function POST(request: NextRequest) {
  try {
    // Registration requires authentication and permission
    const { user: authUser, error: authError } = await authenticate(request);
    if (authError) return authError;

    const perm = await checkPermission(authUser!.userId, authUser!.role, 'employees', 'create');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, email, password, firstName, lastName, role = 'EMPLOYEE' } = body;

    // Validation
    if (!employeeId || !email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'All fields are required: employeeId, email, password, firstName, lastName' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { employeeId },
        ],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or employee ID already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          employeeId,
          email,
          password: hashedPassword,
          role,
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode: employeeId,
          firstName,
          lastName,
          email,
        },
      });

      return { user, employee };
    });

    // Generate token
    const token = generateToken({
      userId: result.user.id,
      employeeId: result.user.employeeId,
      email: result.user.email,
      role: result.user.role,
    });

    // Log activity
    await logActivity({
      userId: result.user.id,
      action: ActivityActions.EMPLOYEE_CREATE,
      module: ActivityModules.AUTH,
      resourceId: result.employee.id,
      description: `New user registered: ${email}`,
      request,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: result.user.id,
        employeeId: result.user.employeeId,
        email: result.user.email,
        role: result.user.role,
        name: `${firstName} ${lastName}`,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
