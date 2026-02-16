import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { verifyToken } from '../../../../lib/auth';
import { checkPermission } from '../../../../lib/permissions';
import { notify } from '../../../../lib/notifications';

// POST toggle employee activation status
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check permission - need employees:edit at minimum
    const permission = await checkPermission(decoded.userId, decoded.role, 'employees', 'edit');
    if (!permission.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, isActive } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
    }

    // Get the employee to find their user ID
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { id: true, role: true } } }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Can't deactivate ADMIN users (unless you're ADMIN yourself)
    if (employee.user.role === 'ADMIN' && decoded.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Cannot deactivate admin users' }, { status: 403 });
    }

    // Can't deactivate yourself
    if (employee.userId === decoded.userId) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    // Update user isActive status
    await prisma.user.update({
      where: { id: employee.userId },
      data: { isActive }
    });

    // Send notification to the employee
    await notify({
      userId: employee.userId,
      title: isActive ? 'Account Unlocked' : 'Account Locked',
      message: isActive
        ? 'Your account has been unlocked. You can now log in to the system.'
        : 'Your account has been locked by administration. Please contact HR for details.',
      type: isActive ? 'INFO' : 'WARNING',
      module: 'employees',
      link: '/dashboard/profile',
    });

    return NextResponse.json({ 
      message: isActive ? 'Employee account activated' : 'Employee account deactivated',
      data: { employeeId, isActive }
    });
  } catch (error) {
    console.error('Error toggling employee activation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
