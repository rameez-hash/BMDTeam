import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = body.identifier || body.email; // Accept both
    const { password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/Employee ID and password are required' },
        { status: 400 }
      );
    }

    // Find user by email or employee ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { employeeId: identifier },
        ],
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            designation: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact HR.' },
        { status: 403 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    });

    // Log activity
    await logActivity({
      userId: user.id,
      action: ActivityActions.LOGIN,
      module: ActivityModules.AUTH,
      description: `User ${user.email} logged in`,
      request,
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        employeeId: user.employeeId,
        employeeDbId: user.employee?.id || null,
        email: user.email,
        role: user.role,
        name: user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : user.email,
        profileImage: user.employee?.profileImage,
        designation: user.employee?.designation || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
