export const dynamic = 'force-dynamic';

import { parseDateUTC } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/employees/[id]/experience
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    const experience = await prisma.experience.findMany({
      where: { employeeId: id },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: experience,
    });
  } catch (error) {
    console.error('Get experience error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/employees/[id]/experience
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const isOwnProfile = employee.userId === user!.userId;
    const editPerm = await checkPermission(user!.userId, user!.role, 'employees', 'edit');

    if (!isOwnProfile && !editPerm.allowed) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const { companyName, jobTitle, location, startDate, endDate, isCurrent, description } = body;

    if (!companyName || !jobTitle || !startDate) {
      return NextResponse.json(
        { error: 'Company name, job title, and start date are required' },
        { status: 400 }
      );
    }

    const experience = await prisma.experience.create({
      data: {
        employeeId: id,
        companyName,
        jobTitle,
        location,
        startDate: parseDateUTC(startDate),
        endDate: endDate ? parseDateUTC(endDate) : null,
        isCurrent: isCurrent || false,
        description,
      },
    });

    return NextResponse.json({
      success: true,
      data: experience,
    }, { status: 201 });
  } catch (error) {
    console.error('Create experience error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
