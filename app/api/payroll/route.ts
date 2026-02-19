export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { getPaginationParams, getMonthRange, getWorkingDaysInMonth, getWorkDays, calculateLateDeduction, calculateTax } from '@/lib/utils';
import { notifyMany } from '@/lib/notifications';

// GET /api/payroll - List payroll records
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const employeeId = searchParams.get('employeeId');
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (month) where.month = parseInt(month);
    if (year) where.year = parseInt(year);
    if (status) where.status = status;

    const viewPerm = await checkPermission(user!.userId, user!.role, 'payroll', 'view');
    if (!viewPerm.allowed) {
      // Only show own payroll
      where.employee = { userId: user!.userId };
    } else if (viewPerm.scope === 'SELF') {
      where.employee = { userId: user!.userId };
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const currentEmp = await prisma.employee.findUnique({ where: { userId: user!.userId }, select: { departmentId: true } });
      if (employeeId) {
        where.employeeId = employeeId;
        where.employee = { departmentId: currentEmp?.departmentId };
      } else {
        where.employee = { departmentId: currentEmp?.departmentId };
      }
    } else {
      // ALL scope - apply specific filters if provided
      if (employeeId) {
        where.employeeId = employeeId;
      } else if (departmentId) {
        where.employee = { departmentId };
      }
    }

    const [records, total] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { id: true, name: true } },
            },
          },
          manualDeductions: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { firstName: 'asc' } }],
      }),
      prisma.payrollRecord.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get payroll error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/payroll - Generate payroll
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { month, year, employeeIds, departmentId } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    // Check if payroll generation is locked for this period
    const lockSettings = await prisma.payrollSettings.findUnique({
      where: { month_year: { month: parseInt(month), year: parseInt(year) } },
    });
    const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);

    // Check manual lock
    if (lockSettings?.isPayrollLocked) {
      return NextResponse.json(
        { error: `Payroll generation is locked for ${monthNames[parsedMonth]} ${parsedYear}. Unlock from Settings → Payroll to generate.` },
        { status: 400 }
      );
    }

    // Check date-based auto-lock: if payrollLockDay is set and today >= that day of the payroll month
    if (lockSettings?.payrollLockDay && lockSettings.payrollLockDay > 0) {
      const today = new Date();
      const lockDate = new Date(parsedYear, parsedMonth - 1, lockSettings.payrollLockDay);
      if (today >= lockDate) {
        // Auto-set the lock
        await prisma.payrollSettings.update({
          where: { month_year: { month: parsedMonth, year: parsedYear } },
          data: { isPayrollLocked: true, payrollLockedAt: new Date() },
        });
        return NextResponse.json(
          { error: `Payroll generation is auto-locked for ${monthNames[parsedMonth]} ${parsedYear} (lock date: ${lockSettings.payrollLockDay}). Update lock date from Settings → Payroll.` },
          { status: 400 }
        );
      }
    }

    // Get employees to process
    const employeeWhere: Record<string, unknown> = {
      employmentStatus: 'ACTIVE',
      salary: { isNot: null },
    };

    if (employeeIds?.length) {
      employeeWhere.id = { in: employeeIds };
    } else if (departmentId) {
      employeeWhere.departmentId = departmentId;
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      include: {
        salary: true,
        shift: true,
        user: { select: { id: true } },
      },
    });

    if (employees.length === 0) {
      // Check if there are active employees without salary to give a specific message
      const activeCount = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } });
      const withSalaryCount = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE', salary: { isNot: null } } });
      
      let errorMsg = 'No eligible employees found';
      if (activeCount > 0 && withSalaryCount === 0) {
        errorMsg = `No eligible employees found. ${activeCount} active employee(s) exist but none have salary assigned. Please assign salaries first from the Salaries tab.`;
      } else if (activeCount === 0) {
        errorMsg = 'No active employees found. Please add employees and set their status to Active.';
      }
      
      return NextResponse.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    // Get holidays for the month
    const { start, end } = getMonthRange(month, year);
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: start, lte: end },
        isOptional: false,
      },
      select: { date: true },
    });

    // Determine the effective end date for calculations:
    // - If generating for the current month, only count up to TODAY
    // - If past month, use full month
    const now = new Date();
    const isCurrentMonth = month === (now.getMonth() + 1) && year === now.getFullYear();
    const holidayDates = holidays.map(h => h.date);

    // Get late rules
    const lateRules = await prisma.lateRule.findMany({
      where: { isActive: true },
      orderBy: { minLateCount: 'asc' },
    });

    // Get active tax slabs for recalculating TDS at generation time
    const taxSlabs = await prisma.taxSlab.findMany({
      where: { isActive: true },
      orderBy: { minIncome: 'asc' },
    });

    const payrollRecords = [];

    // IMPORTANT: Payroll records are immutable snapshots
    // They capture salary components at generation time and won't change
    // even if salary or tax slabs are updated later
    for (const employee of employees) {
      if (!employee.salary) continue;

      // Per-employee working days based on their shift workDays
      const empWorkDays = getWorkDays(employee.shift?.workDays);
      
      // If employee joined mid-month, only count working days from joining date
      // Use attendanceStartDate if set (for when dashboard access was given later than joining)
      const empJoinDate = employee.attendanceStartDate
        ? new Date(employee.attendanceStartDate)
        : employee.joiningDate ? new Date(employee.joiningDate) : null;
      const effectiveStart = empJoinDate && empJoinDate > start ? empJoinDate : start;
      
      // Calculate total working days from effective start (respecting joining date)
      let totalWorkingDays = 0;
      {
        const cur = new Date(effectiveStart);
        while (cur <= end) {
          if (empWorkDays.includes(cur.getDay())) {
            const isHoliday = holidays.some(h => {
              const hd = new Date(h.date);
              return hd.getFullYear() === cur.getFullYear() && hd.getMonth() === cur.getMonth() && hd.getDate() === cur.getDate();
            });
            if (!isHoliday) totalWorkingDays++;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      
      let elapsedWorkingDays = totalWorkingDays;
      if (isCurrentMonth) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let count = 0;
        const current = new Date(effectiveStart);
        while (current <= today && current <= end) {
          if (empWorkDays.includes(current.getDay())) {
            const isHoliday = holidays.some(h => {
              const hd = new Date(h.date);
              return hd.getFullYear() === current.getFullYear() && hd.getMonth() === current.getMonth() && hd.getDate() === current.getDate();
            });
            if (!isHoliday) count++;
          }
          current.setDate(current.getDate() + 1);
        }
        elapsedWorkingDays = count;
      }

      // Check for existing payroll
      const existing = await prisma.payrollRecord.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: employee.id,
            month,
            year,
          },
        },
      });

      if (existing) continue; // Skip if already generated

      // Get attendance for the month
      const attendance = await prisma.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: start, lte: end },
        },
      });

      const presentDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;
      const halfDays = attendance.filter(a => a.status === 'HALF_DAY').length;
      const leaveDays = attendance.filter(a => a.status === 'ON_LEAVE').length;
      const lateDays = attendance.filter(a => a.isLate).length;
      
      // effectivePresent: HALF_DAY counts as 0.5 day present
      const effectivePresent = presentDays - (halfDays * 0.5);
      
      // Absent = elapsed working days - effective present - leave
      // Half days contribute 0.5 absent (since effectivePresent counts them as 0.5)
      const absentDays = Math.max(0, elapsedWorkingDays - effectivePresent - leaveDays);

      // Calculate salary components
      // Recalculate TDS from tax slabs at generation time (not just salary.tds)
      // This ensures payroll always uses the latest tax slab configuration
      const salary = employee.salary;
      
      // Calculate full month working days (ignoring joining date) for pro-rating
      const fullMonthWorkingDays = getWorkingDaysInMonth(month, year, holidayDates, empWorkDays);
      
      // Pro-rate ratio: if employee joined mid-month, they get proportional salary
      const proRateRatio = fullMonthWorkingDays > 0 ? totalWorkingDays / fullMonthWorkingDays : 1;
      const isMidMonthJoin = proRateRatio < 1;
      
      // Pro-rate all salary components for mid-month joiners
      const proratedBasic = Math.round(salary.basicSalary * proRateRatio);
      const proratedHra = Math.round(salary.hra * proRateRatio);
      const proratedDa = Math.round(salary.da * proRateRatio);
      const proratedTa = Math.round(salary.ta * proRateRatio);
      const proratedMedical = Math.round(salary.medicalAllowance * proRateRatio);
      const proratedOtherAllow = Math.round(salary.otherAllowances * proRateRatio);
      const proratedGross = proratedBasic + proratedHra + proratedDa + proratedTa + proratedMedical + proratedOtherAllow;
      
      // Daily rate based on pro-rated gross and eligible working days
      const dailyRate = totalWorkingDays > 0 ? proratedGross / totalWorkingDays : 0;

      // Recalculate TDS using active tax slabs (based on full salary for annual projection)
      let tds = salary.tds;
      if (taxSlabs.length > 0) {
        tds = calculateTax(salary.grossSalary, taxSlabs);
      }
      // Pro-rate TDS for mid-month joiners
      if (isMidMonthJoin) {
        tds = Math.round(tds * proRateRatio);
      }
      
      // Pro-rate fixed deductions for mid-month joiners
      const proratedPf = isMidMonthJoin ? Math.round(salary.pf * proRateRatio) : salary.pf;
      const proratedEsi = isMidMonthJoin ? Math.round(salary.esi * proRateRatio) : salary.esi;
      const proratedProfTax = isMidMonthJoin ? Math.round(salary.professionalTax * proRateRatio) : salary.professionalTax;
      const proratedOtherDed = isMidMonthJoin ? Math.round(salary.otherDeductions * proRateRatio) : salary.otherDeductions;
      
      // Calculate late deduction using daily rate (not full monthly salary)
      const lateDeduction = calculateLateDeduction(
        lateDays,
        dailyRate,
        lateRules.map(r => ({
          minLateCount: r.minLateCount,
          maxLateCount: r.maxLateCount,
          deductionType: r.deductionType,
          deductionValue: r.deductionValue,
          deductionDays: r.deductionDays,
        }))
      );

      // Absent day deduction
      const absentDeduction = Math.max(0, absentDays) * dailyRate;

      // Calculate totals using pro-rated values
      const grossEarnings = proratedGross;
      const totalDeductions = proratedPf + proratedEsi + proratedProfTax + tds + proratedOtherDed + lateDeduction + absentDeduction;
      const netSalary = Math.max(0, grossEarnings - totalDeductions);

      // Create payroll record
      const proRateNote = isMidMonthJoin && empJoinDate
        ? `Pro-rated salary: Joined ${empJoinDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} (${totalWorkingDays}/${fullMonthWorkingDays} working days, ${Math.round(proRateRatio * 100)}%)`
        : null;
      
      const record = await prisma.payrollRecord.create({
        data: {
          employeeId: employee.id,
          month,
          year,
          workingDays: isCurrentMonth ? elapsedWorkingDays : totalWorkingDays,
          presentDays: effectivePresent,
          leaveDays,
          absentDays: Math.max(0, absentDays),
          halfDays,
          lateDays,
          basicSalary: proratedBasic,
          hra: proratedHra,
          da: proratedDa,
          ta: proratedTa,
          medicalAllowance: proratedMedical,
          otherAllowances: proratedOtherAllow,
          pf: proratedPf,
          esi: proratedEsi,
          professionalTax: proratedProfTax,
          tds,
          lateDeduction,
          absentDeduction,
          otherDeductions: proratedOtherDed,
          grossEarnings,
          totalDeductions,
          netSalary,
          notes: proRateNote,
          status: 'DRAFT',
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
        },
      });

      payrollRecords.push(record);

      // --- PF Contribution Tracking ---
      // If employee has PF enabled (pf > 0), create a PF contribution record
      if (proratedPf > 0) {
        // Employer contribution = same as employee (matching contribution)
        const employerContribution = proratedPf;
        const totalPfContribution = proratedPf + employerContribution;

        // Get previous running balance
        const lastPfRecord = await prisma.pFContribution.findFirst({
          where: { employeeId: employee.id },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          select: { runningBalance: true },
        });
        const prevBalance = lastPfRecord?.runningBalance || 0;
        const newBalance = prevBalance + totalPfContribution;

        // Upsert PF contribution (in case payroll is regenerated)
        await prisma.pFContribution.upsert({
          where: {
            employeeId_month_year: {
              employeeId: employee.id,
              month,
              year,
            },
          },
          create: {
            employeeId: employee.id,
            payrollRecordId: record.id,
            month,
            year,
            employeeContribution: proratedPf,
            employerContribution,
            totalContribution: totalPfContribution,
            runningBalance: newBalance,
            basicSalary: proratedBasic,
            pfRate: 12, // 12% rate
          },
          update: {
            payrollRecordId: record.id,
            employeeContribution: proratedPf,
            employerContribution,
            totalContribution: totalPfContribution,
            runningBalance: newBalance,
            basicSalary: proratedBasic,
            pfRate: 12,
          },
        });
      }
    }

    // Log activity
    await logActivity({
      userId: user!.userId,
      action: ActivityActions.PAYROLL_GENERATE,
      module: ActivityModules.PAYROLL,
      description: `Generated payroll for ${payrollRecords.length} employees for ${month}/${year}`,
      request,
    });

    // Notify employees that their payroll was generated (only if new records were created)
    if (payrollRecords.length > 0) {
      const empUserIds = payrollRecords
        .map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return emp?.user?.id;
        })
        .filter((id): id is string => !!id);
      
      if (empUserIds.length > 0) {
        await notifyMany(empUserIds, {
          title: 'Payroll Generated',
          message: `Your payroll for ${monthNames[month]} ${year} has been generated. Check your payslip for details.`,
          type: 'PAYROLL_GENERATED',
          module: 'payroll',
          link: '/dashboard/my-payslips',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: payrollRecords,
      message: `Generated payroll for ${payrollRecords.length} employees`,
    }, { status: 201 });
  } catch (error) {
    console.error('Generate payroll error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/payroll - Update payroll record status
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, status, paidAt, paymentReference, notes, manualDeduction, deductionReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'Payroll record ID required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      if (status === 'PAID' && !paidAt) {
        updateData.paidAt = new Date();
      }
    }
    if (paidAt) updateData.paidAt = new Date(paidAt);
    if (paymentReference !== undefined) updateData.paymentReference = paymentReference;
    if (notes !== undefined) updateData.notes = notes;
    
    // Handle manual deduction update
    if (manualDeduction !== undefined) {
      updateData.manualDeduction = parseFloat(manualDeduction);
      if (deductionReason !== undefined) {
        updateData.deductionReason = deductionReason;
      }
      
      // Recalculate totals
      const existingRecord = await prisma.payrollRecord.findUnique({
        where: { id },
      });
      
      if (existingRecord) {
        const newTotalDeductions = 
          (existingRecord.pf || 0) +
          (existingRecord.esi || 0) +
          (existingRecord.professionalTax || 0) +
          (existingRecord.tds || 0) +
          (existingRecord.lateDeduction || 0) +
          (existingRecord.absentDeduction || 0) +
          (existingRecord.otherDeductions || 0) +
          parseFloat(manualDeduction);
        
        const newNetSalary = existingRecord.grossEarnings - newTotalDeductions;
        
        updateData.totalDeductions = newTotalDeductions;
        updateData.netSalary = Math.max(0, newNetSalary);
      }
    }

    const record = await prisma.payrollRecord.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeCode: true, userId: true },
        },
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.PAYROLL_UPDATE,
      module: ActivityModules.PAYROLL,
      resourceId: id,
      description: `Updated payroll status to ${status} for ${record.employee.firstName} ${record.employee.lastName}`,
      request,
    });

    // Notify employee when payroll is marked as PAID (only if status actually changed)
    if (status === 'PAID' && record.employee.userId) {
      // Check if it was already PAID before this update to avoid duplicate notifications
      const wasPaid = await prisma.payrollRecord.findUnique({
        where: { id },
        select: { status: true },
      });
      // wasPaid is the updated record, but we can check if notification already exists
      const existingNotif = await prisma.notification.findFirst({
        where: {
          userId: record.employee.userId,
          type: 'PAYROLL_PAID',
          resourceId: id,
        },
      });
      if (!existingNotif) {
        const { notify } = await import('@/lib/notifications');
        await notify({
          userId: record.employee.userId,
          title: 'Salary Paid',
          message: `Your salary for ${record.month}/${record.year} has been paid. Net amount: Rs ${Math.round(record.netSalary).toLocaleString('en-PK')}`,
          type: 'PAYROLL_PAID',
          module: 'payroll',
          resourceId: id,
          link: '/dashboard/my-payslips',
        });
      }
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    console.error('Update payroll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/payroll - Delete payroll record(s) (only DRAFT status)
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'payroll', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const ids = searchParams.get('ids'); // Comma-separated IDs for bulk delete
    const deleteAll = searchParams.get('all'); // "true" to delete all DRAFT records for a month
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    // Bulk delete all DRAFT records for a month/year
    if (deleteAll === 'true' && month && year) {
      const draftRecords = await prisma.payrollRecord.findMany({
        where: { month: parseInt(month), year: parseInt(year), status: 'DRAFT' },
        select: { id: true },
      });
      
      if (draftRecords.length === 0) {
        return NextResponse.json({ error: 'No draft records found to delete' }, { status: 400 });
      }

      // Delete related manual deductions first
      await prisma.manualDeduction.deleteMany({
        where: { payrollRecordId: { in: draftRecords.map(r => r.id) } },
      });
      
      const result = await prisma.payrollRecord.deleteMany({
        where: { id: { in: draftRecords.map(r => r.id) } },
      });

      await logActivity({
        userId: user!.userId,
        action: ActivityActions.PAYROLL_DELETE,
        module: ActivityModules.PAYROLL,
        description: `Bulk deleted ${result.count} draft payroll records for ${month}/${year}`,
        request,
      });

      return NextResponse.json({ success: true, message: `Deleted ${result.count} draft payroll records` });
    }

    // Bulk delete by IDs
    if (ids) {
      const idList = ids.split(',').map(i => i.trim()).filter(Boolean);
      
      // Verify all are DRAFT
      const records = await prisma.payrollRecord.findMany({
        where: { id: { in: idList } },
        select: { id: true, status: true },
      });

      const nonDraft = records.filter(r => r.status !== 'DRAFT');
      if (nonDraft.length > 0) {
        return NextResponse.json({ error: `${nonDraft.length} record(s) are not in DRAFT status and cannot be deleted` }, { status: 400 });
      }

      // Delete related manual deductions first
      await prisma.manualDeduction.deleteMany({
        where: { payrollRecordId: { in: idList } },
      });

      const result = await prisma.payrollRecord.deleteMany({
        where: { id: { in: idList }, status: 'DRAFT' },
      });

      await logActivity({
        userId: user!.userId,
        action: ActivityActions.PAYROLL_DELETE,
        module: ActivityModules.PAYROLL,
        description: `Bulk deleted ${result.count} payroll records`,
        request,
      });

      return NextResponse.json({ success: true, message: `Deleted ${result.count} payroll records` });
    }

    // Single delete
    if (!id) {
      return NextResponse.json({ error: 'Payroll record ID required' }, { status: 400 });
    }

    // Only allow deleting DRAFT records
    const record = await prisma.payrollRecord.findUnique({
      where: { id },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });

    if (!record) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 });
    }

    if (record.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Can only delete DRAFT payroll records' },
        { status: 400 }
      );
    }

    // Delete related manual deductions first
    await prisma.manualDeduction.deleteMany({
      where: { payrollRecordId: id },
    });

    await prisma.payrollRecord.delete({ where: { id } });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.PAYROLL_DELETE,
      module: ActivityModules.PAYROLL,
      resourceId: id,
      description: `Deleted payroll record for ${record.employee.firstName} ${record.employee.lastName}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Payroll record deleted' });
  } catch (error) {
    console.error('Delete payroll error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
