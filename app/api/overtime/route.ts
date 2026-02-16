import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { notify } from '@/lib/notifications';

// GET /api/overtime - Get overtime records & rules
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'records'; // 'records' | 'rules'
    const month = searchParams.get('month'); // YYYY-MM
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    if (view === 'rules') {
      const rulesPerm = await checkPermission(user!.userId, user!.role, 'overtime', 'manage');
      if (!rulesPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const rules = await prisma.overtimeRule.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ rules });
    }

    // Records - apply scope
    const where: any = {};

    const viewPerm = await checkPermission(user!.userId, user!.role, 'overtime', 'view');
    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      where.employeeId = emp.id;
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      const deptEmps = await prisma.employee.findMany({
        where: { departmentId: emp.departmentId },
        select: { id: true },
      });
      where.employeeId = { in: deptEmps.map(e => e.id) };
    }

    if (employeeId) where.employeeId = employeeId;

    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0);
      where.date = { gte: start, lte: end };
    }

    if (status && status !== 'ALL') where.status = status;

    const records = await prisma.overtimeRecord.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    // Get employee details
    const empIds = [...new Set(records.map((r: any) => r.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: {
        id: true, firstName: true, lastName: true, employeeCode: true,
        profileImage: true, department: { select: { name: true } },
        salary: { select: { basicSalary: true } },
      },
    });

    const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const enriched = records.map(r => ({
      ...r,
      employee: empMap[r.employeeId] || null,
    }));

    // All employees for filter
    const allEmployees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: 'asc' },
    });

    // Get active OT rule
    const activeRule = await prisma.overtimeRule.findFirst({
      where: { isActive: true },
    });

    // Summary stats
    const totalHours = records.reduce((sum: number, r: any) => sum + r.overtimeHours, 0);
    const pendingCount = records.filter((r: any) => r.status === 'PENDING').length;

    return NextResponse.json({
      records: enriched,
      employees: allEmployees,
      activeRule,
      stats: { totalHours: Math.round(totalHours * 100) / 100, totalRecords: records.length, pendingCount },
    });
  } catch (error) {
    console.error('Error fetching overtime:', error);
    return NextResponse.json({ error: 'Failed to fetch overtime data' }, { status: 500 });
  }
}

// POST /api/overtime - Create OT record or rule
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;

    const body = await request.json();
    const { action } = body;

    if (action === 'create_rule') {
      const rulePerm = await checkPermission(user!.userId, user!.role, 'overtime', 'manage');
      if (!rulePerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { name, regularRate, weekendRate, holidayRate, maxDailyHours, maxMonthlyHours, minOvertimeMinutes } = body;
      if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

      const rule = await prisma.overtimeRule.create({
        data: {
          name,
          regularRate: regularRate || 1.5,
          weekendRate: weekendRate || 2.0,
          holidayRate: holidayRate || 2.5,
          maxDailyHours: maxDailyHours || 4,
          maxMonthlyHours: maxMonthlyHours || 60,
          minOvertimeMinutes: minOvertimeMinutes || 30,
        },
      });

      return NextResponse.json({ rule }, { status: 201 });
    }

    if (action === 'create_record') {
      const recordPerm = await checkPermission(user!.userId, user!.role, 'overtime', 'manage');
      if (!recordPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { employeeId, date, overtimeHours, overtimeType, notes } = body;
      if (!employeeId || !date || !overtimeHours) {
        return NextResponse.json({ error: 'Employee, date, and hours required' }, { status: 400 });
      }

      // Get active rule for rate calculation
      const rule = await prisma.overtimeRule.findFirst({ where: { isActive: true } });
      let rateMultiplier = 1.5;
      if (rule) {
        switch (overtimeType) {
          case 'WEEKEND': rateMultiplier = rule.weekendRate; break;
          case 'HOLIDAY': rateMultiplier = rule.holidayRate; break;
          default: rateMultiplier = rule.regularRate;
        }
      }

      // Check daily limit
      if (rule && overtimeHours > rule.maxDailyHours) {
        return NextResponse.json({ error: `Overtime exceeds max daily limit of ${rule.maxDailyHours} hours` }, { status: 400 });
      }

      const record = await prisma.overtimeRecord.create({
        data: {
          employeeId,
          date: new Date(date),
          overtimeHours: parseFloat(overtimeHours),
          overtimeType: overtimeType || 'REGULAR',
          rateMultiplier,
          status: recordPerm.scope === 'ALL' ? 'AUTO_APPROVED' : 'PENDING',
          approvedById: recordPerm.scope === 'ALL' ? user!.userId : null,
          approvedAt: recordPerm.scope === 'ALL' ? new Date() : null,
          notes: notes || null,
        },
      });

      // Notify employee
      const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true, firstName: true } });
      if (emp?.userId) {
        await prisma.notification.create({
          data: {
            userId: emp.userId,
            type: 'OVERTIME',
            title: 'Overtime Recorded',
            message: `${overtimeHours} hours of overtime recorded for ${new Date(date).toLocaleDateString()}.`,
            module: 'overtime',
            resourceId: record.id,
            link: '/dashboard/overtime',
          },
        });
      }

      return NextResponse.json({ record }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Overtime record already exists for this employee on this date' }, { status: 400 });
    }
    console.error('Error creating overtime:', error);
    return NextResponse.json({ error: 'Failed to create overtime' }, { status: 500 });
  }
}

// PUT /api/overtime - Approve/reject OT records, update rules
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;

    const body = await request.json();
    const { action } = body;

    if (action === 'approve' || action === 'reject') {
      const approvePerm = await checkPermission(user!.userId, user!.role, 'overtime', 'approve');
      if (!approvePerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { recordId } = body;
      if (!recordId) return NextResponse.json({ error: 'Record ID required' }, { status: 400 });

      const record = await prisma.overtimeRecord.update({
        where: { id: recordId },
        data: {
          status: action === 'approve' ? 'MANUALLY_APPROVED' : 'REJECTED',
          approvedById: user!.userId,
          approvedAt: new Date(),
        },
      });

      // Notify the employee about approval/rejection
      const otEmp = await prisma.employee.findUnique({ where: { id: record.employeeId }, select: { userId: true } });
      if (otEmp?.userId) {
        await notify({
          userId: otEmp.userId,
          title: action === 'approve' ? 'Overtime Approved' : 'Overtime Rejected',
          message: action === 'approve'
            ? `Your overtime request for ${record.overtimeHours} hours has been approved`
            : `Your overtime request has been rejected`,
          type: 'OVERTIME',
          module: 'overtime',
          resourceId: recordId,
          link: '/dashboard/overtime',
        });
      }

      return NextResponse.json({ record });
    }

    if (action === 'update_rule') {
      const updateRulePerm = await checkPermission(user!.userId, user!.role, 'overtime', 'manage');
      if (!updateRulePerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { ruleId, ...data } = body;
      if (!ruleId) return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });

      const rule = await prisma.overtimeRule.update({
        where: { id: ruleId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.regularRate !== undefined && { regularRate: parseFloat(data.regularRate) }),
          ...(data.weekendRate !== undefined && { weekendRate: parseFloat(data.weekendRate) }),
          ...(data.holidayRate !== undefined && { holidayRate: parseFloat(data.holidayRate) }),
          ...(data.maxDailyHours !== undefined && { maxDailyHours: parseFloat(data.maxDailyHours) }),
          ...(data.maxMonthlyHours !== undefined && { maxMonthlyHours: parseFloat(data.maxMonthlyHours) }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      return NextResponse.json({ rule });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating overtime:', error);
    return NextResponse.json({ error: 'Failed to update overtime' }, { status: 500 });
  }
}

// DELETE /api/overtime - Delete OT record or rule
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;
    const deletePerm = await checkPermission(user!.userId, user!.role, 'overtime', 'manage');
    if (!deletePerm.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'record';

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (type === 'rule') {
      await prisma.overtimeRule.delete({ where: { id } });
    } else {
      await prisma.overtimeRecord.delete({ where: { id } });
    }

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting overtime:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

