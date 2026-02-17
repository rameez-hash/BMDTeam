export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';

// GET /api/employees/[id]/subordinates - Get employee hierarchy
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        profileImage: true,
        designation: true,
        department: { select: { name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Get subordinates recursively
    const getSubordinates = async (managerId: string): Promise<unknown[]> => {
      const subordinates = await prisma.employee.findMany({
        where: { reportingManagerId: managerId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          profileImage: true,
          designation: true,
          department: { select: { name: true } },
        },
      });

      const result = [];
      for (const sub of subordinates) {
        const children = await getSubordinates(sub.id);
        result.push({
          ...sub,
          name: `${sub.firstName} ${sub.lastName}`,
          subordinates: children,
        });
      }
      return result;
    };

    const subordinates = await getSubordinates(id);

    return NextResponse.json({
      success: true,
      data: {
        ...employee,
        name: `${employee.firstName} ${employee.lastName}`,
        subordinates,
      },
    });
  } catch (error) {
    console.error('Get subordinates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
