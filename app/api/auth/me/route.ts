export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { getUserPermissions } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const userData = await prisma.user.findUnique({
      where: { id: user!.userId },
      include: {
        employee: {
          include: {
            department: { select: { id: true, name: true } },
            shift: { select: { id: true, name: true, startTime: true, endTime: true } },
            reportingManager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
              },
            },
            appRole: { select: { id: true, name: true, color: true } },
            salary: true,
            emergencyContacts: true,
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's effective permissions
    const permissions = await getUserPermissions(userData.id, userData.role);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = userData;

    return NextResponse.json({
      success: true,
      user: {
        ...userWithoutPassword,
        permissions,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
