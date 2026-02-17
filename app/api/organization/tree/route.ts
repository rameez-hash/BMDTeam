export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';

interface OrgNode {
  id: string;
  name: string;
  employeeCode: string;
  designation: string;
  department: string;
  profileImage: string | null;
  subordinates: OrgNode[];
}

// GET /api/organization/tree - Get organization tree
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    // Get all employees with their reporting structure
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        profileImage: true,
        reportingManagerId: true,
        designation: true,
        department: { select: { name: true } },
      },
    });

    // Build a map for quick lookup
    const employeeMap = new Map<string, typeof employees[0]>();
    employees.forEach(emp => employeeMap.set(emp.id, emp));

    // Find root employees (no reporting manager)
    const roots = employees.filter(emp => !emp.reportingManagerId);

    // Recursive function to build tree
    const buildTree = (employeeId: string): OrgNode => {
      const emp = employeeMap.get(employeeId)!;
      const subordinates = employees
        .filter(e => e.reportingManagerId === employeeId)
        .map(e => buildTree(e.id));

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        employeeCode: emp.employeeCode,
        designation: emp.designation || 'N/A',
        department: emp.department?.name || 'N/A',
        profileImage: emp.profileImage,
        subordinates,
      };
    };

    const tree = roots.map(root => buildTree(root.id));

    return NextResponse.json({
      success: true,
      data: tree,
    });
  } catch (error) {
    console.error('Get organization tree error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
