import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { notify } from '@/lib/notifications';

// GET - List all promotions/increments/transfers
export async function GET(request: NextRequest) {
  try {
    const { user: auth, error } = await authenticate(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (type) where.type = type;

    // Regular employees can only see their own history
    if (!['ADMIN', 'HR'].includes(auth!.role)) {
      where.employeeId = auth!.employeeDbId;
    }

    const [records, total] = await Promise.all([
      prisma.employeeHistory.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              designation: true,
              profileImage: true,
              department: { select: { id: true, name: true } },
              salary: { select: { basicSalary: true, grossSalary: true, netSalary: true } },
            },
          },
          oldDepartment: { select: { id: true, name: true } },
          newDepartment: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.employeeHistory.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('Promotions GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}

// POST - Create a promotion, increment, or transfer
export async function POST(request: NextRequest) {
  try {
    const { user: auth, error } = await authenticate(request);
    if (error) return error;

    // Only ADMIN / HR can create
    if (!['ADMIN', 'HR'].includes(auth!.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const {
      employeeId,
      type, // PROMOTION, INCREMENT, TRANSFER, PROMOTION_WITH_INCREMENT, DEMOTION, ROLE_CHANGE, STATUS_CHANGE, TYPE_CHANGE
      effectiveDate,
      newDesignation,
      newDepartmentId,
      newBasicSalary,
      newEmploymentType,
      newEmploymentStatus,
      reason,
      remarks,
      letterPath,
    } = body;

    if (!employeeId || !type || !effectiveDate) {
      return NextResponse.json(
        { error: 'Employee, type, and effective date are required' },
        { status: 400 }
      );
    }

    // Fetch current employee with salary and department
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: { select: { id: true, name: true } },
        salary: true,
        user: { select: { id: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Build history record data
    const historyData: any = {
      employeeId,
      type,
      effectiveDate: new Date(effectiveDate),
      reason: reason || null,
      remarks: remarks || null,
      approvedById: auth!.userId,
      letterPath: letterPath || null,
    };

    // Track changes to apply
    const employeeUpdates: any = {};
    const notifParts: string[] = [];
    let salaryChanged = false;

    // Designation change (Promotion, Demotion, Role Change, Promotion with Increment)
    if (newDesignation && ['PROMOTION', 'DEMOTION', 'ROLE_CHANGE', 'PROMOTION_WITH_INCREMENT'].includes(type)) {
      historyData.oldDesignation = employee.designation || null;
      historyData.newDesignation = newDesignation;
      employeeUpdates.designation = newDesignation;
      notifParts.push(`Designation: ${employee.designation || 'N/A'} → ${newDesignation}`);
    }

    // Department change (Transfer, or also during promotion)
    if (newDepartmentId && ['TRANSFER', 'PROMOTION', 'PROMOTION_WITH_INCREMENT'].includes(type)) {
      historyData.oldDepartmentId = employee.departmentId || null;
      historyData.newDepartmentId = newDepartmentId;
      employeeUpdates.departmentId = newDepartmentId;
      
      const newDept = await prisma.department.findUnique({ where: { id: newDepartmentId }, select: { name: true } });
      notifParts.push(`Department: ${employee.department?.name || 'N/A'} → ${newDept?.name || 'N/A'}`);
    }

    // Salary change (Increment, Promotion with Increment)
    if (newBasicSalary && ['INCREMENT', 'PROMOTION_WITH_INCREMENT'].includes(type)) {
      const oldSalary = employee.salary;
      historyData.oldBasicSalary = oldSalary?.basicSalary || 0;
      historyData.newBasicSalary = newBasicSalary;
      
      if (oldSalary) {
        historyData.oldGrossSalary = oldSalary.grossSalary;
        // Calculate new gross: basic + allowances
        const newGross = newBasicSalary + (oldSalary.hra || 0) + (oldSalary.da || 0) + (oldSalary.ta || 0) + (oldSalary.medicalAllowance || 0) + (oldSalary.otherAllowances || 0);
        historyData.newGrossSalary = newGross;
      }

      salaryChanged = true;
      const oldBasic = oldSalary?.basicSalary || 0;
      const diff = newBasicSalary - oldBasic;
      const pct = oldBasic > 0 ? ((diff / oldBasic) * 100).toFixed(1) : '0';
      notifParts.push(`Salary: Rs ${oldBasic.toLocaleString()} → Rs ${newBasicSalary.toLocaleString()} (${diff >= 0 ? '+' : ''}${pct}%)`);
    }

    // Employment Type change
    if (newEmploymentType && type === 'TYPE_CHANGE') {
      historyData.oldEmploymentType = employee.employmentType || null;
      historyData.newEmploymentType = newEmploymentType;
      employeeUpdates.employmentType = newEmploymentType;

      const typeLabels: Record<string, string> = {
        PERMANENT: 'Permanent', CONTRACT: 'Contract', TEMPORARY: 'Temporary', INTERN: 'Intern',
        PART_TIME: 'Part-Time', REMOTE: 'Remote', FREELANCER: 'Freelancer', CONSULTANT: 'Consultant',
      };
      notifParts.push(`Employment Type: ${typeLabels[employee.employmentType] || employee.employmentType} → ${typeLabels[newEmploymentType] || newEmploymentType}`);
    }

    // Employment Status change
    if (newEmploymentStatus && type === 'STATUS_CHANGE') {
      historyData.oldEmploymentStatus = employee.employmentStatus || null;
      historyData.newEmploymentStatus = newEmploymentStatus;
      employeeUpdates.employmentStatus = newEmploymentStatus;

      const statusLabels: Record<string, string> = {
        ACTIVE: 'Active', INACTIVE: 'Inactive', ON_LEAVE: 'On Leave', PROBATION: 'Probation',
        SUSPENDED: 'Suspended', RESIGNED: 'Resigned', TERMINATED: 'Terminated', ON_NOTICE: 'On Notice',
        RETIRED: 'Retired', ABSCONDED: 'Absconded',
      };
      notifParts.push(`Employment Status: ${statusLabels[employee.employmentStatus] || employee.employmentStatus} → ${statusLabels[newEmploymentStatus] || newEmploymentStatus}`);
    }

    // Perform all changes in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the history record
      const historyRecord = await tx.employeeHistory.create({ data: historyData });

      // 2. Update employee fields (designation, department)
      if (Object.keys(employeeUpdates).length > 0) {
        await tx.employee.update({
          where: { id: employeeId },
          data: employeeUpdates,
        });
      }

      // 3. Update salary if changed
      if (salaryChanged && newBasicSalary) {
        const currentSalary = employee.salary;
        if (currentSalary) {
          // Save old salary to history
          await tx.salaryHistory.create({
            data: {
              employeeId,
              basicSalary: currentSalary.basicSalary,
              grossSalary: currentSalary.grossSalary,
              netSalary: currentSalary.netSalary,
              effectiveFrom: currentSalary.effectiveFrom,
              effectiveTo: new Date(effectiveDate),
              reason: `${type}: ${reason || 'Salary revision'}`,
            },
          });

          // Calculate new salary
          const gross = newBasicSalary + currentSalary.hra + currentSalary.da + currentSalary.ta + currentSalary.medicalAllowance + currentSalary.otherAllowances;
          const totalDeductions = currentSalary.pf + currentSalary.esi + currentSalary.professionalTax + currentSalary.tds + currentSalary.otherDeductions;
          const net = gross - totalDeductions;

          await tx.salary.update({
            where: { employeeId },
            data: {
              basicSalary: newBasicSalary,
              grossSalary: gross,
              netSalary: net,
              effectiveFrom: new Date(effectiveDate),
            },
          });
        } else {
          // No existing salary — create a new one
          const gross = newBasicSalary;
          await tx.salary.create({
            data: {
              employeeId,
              basicSalary: newBasicSalary,
              grossSalary: gross,
              netSalary: gross,
              effectiveFrom: new Date(effectiveDate),
            },
          });
        }
      }

      return historyRecord;
    });

    // 4. Notify the employee
    const notifTypeLabels: Record<string, string> = {
      PROMOTION: 'Promotion',
      INCREMENT: 'Salary Increment',
      TRANSFER: 'Department Transfer',
      PROMOTION_WITH_INCREMENT: 'Promotion & Increment',
      DEMOTION: 'Role Change',
      ROLE_CHANGE: 'Role Change',
      STATUS_CHANGE: 'Employment Status Change',
      TYPE_CHANGE: 'Employment Type Change',
    };
    const typeLabel = notifTypeLabels[type] || type;
    const notifMessage = notifParts.length > 0
      ? `${notifParts.join(' | ')}. Effective: ${new Date(effectiveDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `Effective from ${new Date(effectiveDate).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    if (employee.user) {
      const congratsTypes = ['PROMOTION', 'INCREMENT', 'PROMOTION_WITH_INCREMENT'];
      const notifTitle = congratsTypes.includes(type) ? `${typeLabel} — Congratulations!` : `${typeLabel} — Update`;
      await notify({
        userId: employee.user.id,
        title: notifTitle,
        message: notifMessage,
        type: 'PROMOTION',
        module: 'promotions',
        resourceId: result.id,
        link: '/dashboard/notifications',
      });
    }

    // 5. Log activity
    const actionMap: Record<string, string> = {
      INCREMENT: ActivityActions.INCREMENT_CREATE,
      TRANSFER: ActivityActions.TRANSFER_CREATE,
      STATUS_CHANGE: 'STATUS_CHANGE_CREATE',
      TYPE_CHANGE: 'TYPE_CHANGE_CREATE',
    };
    await logActivity({
      userId: auth!.userId,
      action: actionMap[type] || ActivityActions.PROMOTION_CREATE,
      module: ActivityModules.PROMOTION,
      resourceId: result.id,
      description: `${typeLabel} for ${employee.firstName} ${employee.lastName}: ${notifParts.join(', ')}`,
      newData: historyData,
      request,
    });

    return NextResponse.json({
      message: `${typeLabel} recorded successfully`,
      data: result,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Promotions POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create record' }, { status: 500 });
  }
}

// DELETE - Delete a history record
export async function DELETE(request: NextRequest) {
  try {
    const { user: auth, error } = await authenticate(request);
    if (error) return error;

    if (!['ADMIN'].includes(auth!.role)) {
      return NextResponse.json({ error: 'Only admins can delete records' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await prisma.employeeHistory.delete({ where: { id } });

    return NextResponse.json({ message: 'Record deleted' });
  } catch (error: any) {
    console.error('Promotions DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
