import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/employees/[id]/education
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;

    const education = await prisma.education.findMany({
      where: { employeeId: id },
      orderBy: { endYear: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: education,
    });
  } catch (error) {
    console.error('Get education error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/employees/[id]/education
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    // Verify employee exists and user has permission
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

    const { degree, institution, board, fieldOfStudy, startYear, endYear, grade, percentage } = body;

    if (!degree || !institution) {
      return NextResponse.json(
        { error: 'Degree and institution are required' },
        { status: 400 }
      );
    }

    const education = await prisma.education.create({
      data: {
        employeeId: id,
        degree,
        institution,
        board,
        fieldOfStudy,
        startYear,
        endYear,
        grade,
        percentage,
      },
    });

    return NextResponse.json({
      success: true,
      data: education,
    }, { status: 201 });
  } catch (error) {
    console.error('Create education error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
