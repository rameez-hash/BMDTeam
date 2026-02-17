export const dynamic = 'force-dynamic';

import { parseDateUTC, formatDate } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';

// GET /api/reports - Generate comprehensive report data
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'reports', 'view');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'attendance';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const format = searchParams.get('format') || 'json';

    const dateFilter = {
      ...(startDate && { gte: parseDateUTC(startDate) }),
      ...(endDate && { lte: new Date(endDate + 'T23:59:59Z') }),
    };

    const employeeFilter: Record<string, unknown> = {
      employmentStatus: 'ACTIVE',
      user: { role: { not: 'ADMIN' } },
    };
    if (departmentId) employeeFilter.departmentId = departmentId;

    // Get departments for filter dropdown
    const departments = await prisma.department.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    // Get filtered employees
    const employees = await prisma.employee.findMany({
      where: employeeFilter,
      include: {
        department: { select: { id: true, name: true } },
        salary: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    const employeeIds = employees.map(e => e.id);

    let reportData: Record<string, unknown> = {};

    // ═══════════ ATTENDANCE REPORT ═══════════
    if (reportType === 'attendance') {
      const attendance = await prisma.attendance.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...(startDate || endDate ? { date: dateFilter } : {}),
        },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeCode: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
      });

      // Per-employee summary
      const empMap: Record<string, {
        id: string; name: string; code: string; department: string;
        present: number; absent: number; late: number; halfDay: number; onLeave: number;
        totalHours: number; workDayCount: number;
      }> = {};

      for (const emp of employees) {
        empMap[emp.id] = {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          code: emp.employeeCode,
          department: emp.department?.name || '—',
          present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0,
          totalHours: 0, workDayCount: 0,
        };
      }

      for (const a of attendance) {
        const emp = empMap[a.employeeId];
        if (!emp) continue;
        if (a.status === 'PRESENT' || a.checkIn) emp.present++;
        if (a.status === 'ABSENT') emp.absent++;
        if (a.isLate) emp.late++;
        if (a.status === 'HALF_DAY') emp.halfDay++;
        if (a.status === 'ON_LEAVE') emp.onLeave++;
        if (a.workHours) { emp.totalHours += a.workHours; emp.workDayCount++; }
      }

      const employeeDetails = Object.values(empMap).map(e => ({
        ...e,
        avgHours: e.workDayCount > 0 ? (e.totalHours / e.workDayCount).toFixed(1) : '0.0',
        totalDays: e.present + e.absent + e.halfDay + e.onLeave,
        attendanceRate: (e.present + e.absent + e.halfDay + e.onLeave) > 0
          ? ((e.present / (e.present + e.absent + e.halfDay + e.onLeave)) * 100).toFixed(1)
          : '0.0',
      }));

      // Department summary
      const deptMap: Record<string, { name: string; total: number; present: number; absent: number; late: number }> = {};
      for (const dept of departments) {
        deptMap[dept.name] = { name: dept.name, total: 0, present: 0, absent: 0, late: 0 };
      }
      for (const a of attendance) {
        const dname = a.employee?.department?.name;
        if (dname && deptMap[dname]) {
          deptMap[dname].total++;
          if (a.status === 'PRESENT' || a.checkIn) deptMap[dname].present++;
          if (a.status === 'ABSENT') deptMap[dname].absent++;
          if (a.isLate) deptMap[dname].late++;
        }
      }

      // Day-by-day attendance records
      const attendanceRecords = attendance.slice(0, 1000).map(a => ({
        id: a.id,
        employeeId: a.employeeId,
        employee: `${a.employee.firstName} ${a.employee.lastName}`,
        code: a.employee.employeeCode,
        department: a.employee.department?.name || '—',
        date: formatDate(a.date),
        checkIn: a.checkIn ? a.checkIn.toISOString() : null,
        checkOut: a.checkOut ? a.checkOut.toISOString() : null,
        status: a.status,
        isLate: a.isLate,
        lateMinutes: a.lateMinutes,
        workHours: a.workHours ? Number(a.workHours.toFixed(1)) : 0,
        shiftName: a.shiftName || '—',
      }));

      reportData = {
        summary: {
          totalRecords: attendance.length,
          presentDays: attendance.filter(a => a.status === 'PRESENT' || a.checkIn).length,
          absentDays: attendance.filter(a => a.status === 'ABSENT').length,
          lateDays: attendance.filter(a => a.isLate).length,
          halfDays: attendance.filter(a => a.status === 'HALF_DAY').length,
          onLeave: attendance.filter(a => a.status === 'ON_LEAVE').length,
          avgWorkHours: attendance.length > 0
            ? (attendance.reduce((s, a) => s + (a.workHours || 0), 0) / (attendance.filter(a => a.workHours).length || 1)).toFixed(1)
            : '0.0',
        },
        employeeDetails,
        byDepartment: Object.values(deptMap).filter(d => d.total > 0),
        attendanceRecords,
      };
    }

    // ═══════════ LEAVE REPORT ═══════════
    else if (reportType === 'leave') {
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...(startDate || endDate ? { startDate: dateFilter } : {}),
        },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeCode: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Per-employee leave summary
      const empLeaveMap: Record<string, {
        id: string; name: string; code: string; department: string;
        total: number; approved: number; pending: number; rejected: number; totalDays: number;
      }> = {};

      for (const emp of employees) {
        empLeaveMap[emp.id] = {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          code: emp.employeeCode,
          department: emp.department?.name || '—',
          total: 0, approved: 0, pending: 0, rejected: 0, totalDays: 0,
        };
      }

      for (const lr of leaveRequests) {
        const emp = empLeaveMap[lr.employeeId];
        if (!emp) continue;
        emp.total++;
        if (lr.status === 'APPROVED') { emp.approved++; emp.totalDays += lr.totalDays; }
        if (lr.status === 'PENDING') emp.pending++;
        if (lr.status === 'REJECTED') emp.rejected++;
      }

      // By leave type
      const byType: Record<string, { name: string; count: number; approved: number; pending: number; rejected: number; totalDays: number }> = {};
      for (const lr of leaveRequests) {
        const tname = lr.leaveType?.name || 'Other';
        if (!byType[tname]) byType[tname] = { name: tname, count: 0, approved: 0, pending: 0, rejected: 0, totalDays: 0 };
        byType[tname].count++;
        if (lr.status === 'APPROVED') { byType[tname].approved++; byType[tname].totalDays += lr.totalDays; }
        if (lr.status === 'PENDING') byType[tname].pending++;
        if (lr.status === 'REJECTED') byType[tname].rejected++;
      }

      // Recent requests list (detailed)
      const recentRequests = leaveRequests.slice(0, 200).map(lr => ({
        id: lr.id,
        employee: `${lr.employee.firstName} ${lr.employee.lastName}`,
        code: lr.employee.employeeCode,
        department: lr.employee.department?.name || '—',
        leaveType: lr.leaveType?.name || '—',
        startDate: formatDate(lr.startDate),
        endDate: formatDate(lr.endDate),
        totalDays: lr.totalDays,
        status: lr.status,
        reason: lr.reason || '—',
      }));

      // Leave balances for current year
      const currentYear = new Date().getFullYear();
      const leaveBalanceRecords = await prisma.leaveBalance.findMany({
        where: {
          employeeId: { in: employeeIds },
          year: currentYear,
        },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeCode: true,
              department: { select: { name: true } },
            },
          },
          leaveType: { select: { name: true, code: true } },
        },
      });

      // Group leave balances by employee
      const empBalances: Record<string, {
        id: string; name: string; code: string; department: string;
        balances: Array<{ leaveType: string; total: number; used: number; pending: number; remaining: number }>;
        totalAllocated: number; totalUsed: number; totalPending: number; totalRemaining: number;
      }> = {};

      for (const emp of employees) {
        empBalances[emp.id] = {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          code: emp.employeeCode,
          department: emp.department?.name || '—',
          balances: [],
          totalAllocated: 0, totalUsed: 0, totalPending: 0, totalRemaining: 0,
        };
      }

      for (const lb of leaveBalanceRecords) {
        const emp = empBalances[lb.employeeId];
        if (!emp) continue;
        const remaining = lb.totalDays - lb.usedDays - lb.pendingDays;
        emp.balances.push({
          leaveType: lb.leaveType?.name || '—',
          total: lb.totalDays,
          used: lb.usedDays,
          pending: lb.pendingDays,
          remaining: remaining > 0 ? remaining : 0,
        });
        emp.totalAllocated += lb.totalDays;
        emp.totalUsed += lb.usedDays;
        emp.totalPending += lb.pendingDays;
        emp.totalRemaining += remaining > 0 ? remaining : 0;
      }

      // Get unique leave type names for columns
      const leaveTypeNames = [...new Set(leaveBalanceRecords.map(lb => lb.leaveType?.name || '—'))];

      reportData = {
        summary: {
          totalRequests: leaveRequests.length,
          approved: leaveRequests.filter(l => l.status === 'APPROVED').length,
          pending: leaveRequests.filter(l => l.status === 'PENDING').length,
          rejected: leaveRequests.filter(l => l.status === 'REJECTED').length,
          totalDaysUsed: leaveRequests.filter(l => l.status === 'APPROVED').reduce((s, l) => s + l.totalDays, 0),
        },
        employeeDetails: Object.values(empLeaveMap).filter(e => e.total > 0),
        byType: Object.values(byType),
        recentRequests,
        leaveBalances: Object.values(empBalances).filter(e => e.balances.length > 0),
        leaveTypeNames,
      };
    }

    // ═══════════ PAYROLL REPORT ═══════════
    else if (reportType === 'payroll') {
      const payrollRecords = await prisma.payrollRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        include: {
          employee: {
            select: {
              id: true, firstName: true, lastName: true, employeeCode: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Per-employee payroll
      const empPayMap: Record<string, {
        id: string; name: string; code: string; department: string;
        records: number; totalGross: number; totalDeductions: number; totalNet: number;
        totalTax: number; totalPf: number;
      }> = {};

      for (const pr of payrollRecords) {
        if (!empPayMap[pr.employeeId]) {
          empPayMap[pr.employeeId] = {
            id: pr.employeeId,
            name: `${pr.employee.firstName} ${pr.employee.lastName}`,
            code: pr.employee.employeeCode,
            department: pr.employee.department?.name || '—',
            records: 0, totalGross: 0, totalDeductions: 0, totalNet: 0,
            totalTax: 0, totalPf: 0,
          };
        }
        const emp = empPayMap[pr.employeeId];
        emp.records++;
        emp.totalGross += pr.grossEarnings;
        emp.totalDeductions += pr.totalDeductions;
        emp.totalNet += pr.netSalary;
        emp.totalTax += pr.tds || 0;
        emp.totalPf += pr.pf || 0;
      }

      // Department summary
      const deptPayMap: Record<string, { name: string; totalPaid: number; totalPending: number; count: number }> = {};
      for (const pr of payrollRecords) {
        const dname = pr.employee?.department?.name || 'Unknown';
        if (!deptPayMap[dname]) deptPayMap[dname] = { name: dname, totalPaid: 0, totalPending: 0, count: 0 };
        deptPayMap[dname].count++;
        if (pr.status === 'PAID') deptPayMap[dname].totalPaid += pr.netSalary;
        else deptPayMap[dname].totalPending += pr.netSalary;
      }

      // Individual payroll records for detailed view
      const payrollDetails = payrollRecords.slice(0, 200).map(pr => ({
        id: pr.id,
        employee: `${pr.employee.firstName} ${pr.employee.lastName}`,
        code: pr.employee.employeeCode,
        department: pr.employee.department?.name || '—',
        month: pr.month,
        year: pr.year,
        workingDays: pr.workingDays,
        presentDays: pr.presentDays,
        grossSalary: pr.grossEarnings,
        basicSalary: pr.basicSalary,
        totalDeductions: pr.totalDeductions,
        tds: pr.tds || 0,
        pf: pr.pf || 0,
        lateDeduction: pr.lateDeduction || 0,
        absentDeduction: pr.absentDeduction || 0,
        netSalary: pr.netSalary,
        status: pr.status,
      }));

      reportData = {
        summary: {
          totalRecords: payrollRecords.length,
          totalGross: payrollRecords.reduce((s, p) => s + p.grossEarnings, 0),
          totalDeductions: payrollRecords.reduce((s, p) => s + p.totalDeductions, 0),
          totalNet: payrollRecords.reduce((s, p) => s + p.netSalary, 0),
          totalPaid: payrollRecords.filter(p => p.status === 'PAID').reduce((s, p) => s + p.netSalary, 0),
          totalPending: payrollRecords.filter(p => p.status !== 'PAID').reduce((s, p) => s + p.netSalary, 0),
          totalTax: payrollRecords.reduce((s, p) => s + (p.tds || 0), 0),
          totalPf: payrollRecords.reduce((s, p) => s + (p.pf || 0), 0),
          avgSalary: payrollRecords.length > 0
            ? payrollRecords.reduce((s, p) => s + p.netSalary, 0) / payrollRecords.length
            : 0,
        },
        employeeDetails: Object.values(empPayMap),
        byDepartment: Object.values(deptPayMap).filter(d => d.count > 0),
        payrollDetails,
      };
    }

    // ═══════════ EMPLOYEES REPORT ═══════════
    else if (reportType === 'employees') {
      const empDetails = employees.map(e => ({
        id: e.id,
        name: `${e.firstName} ${e.lastName}`,
        code: e.employeeCode,
        email: e.email,
        phone: e.phone || '—',
        department: e.department?.name || '—',
        designation: e.designation || '—',
        employmentType: e.employmentType,
        joiningDate: e.joiningDate ? formatDate(e.joiningDate) : '—',
        confirmationDate: e.confirmationDate ? formatDate(e.confirmationDate) : '—',
        basicSalary: e.salary?.basicSalary || 0,
        grossSalary: e.salary?.grossSalary || 0,
        netSalary: e.salary?.netSalary || 0,
      }));

      const byType: Record<string, number> = {};
      for (const e of employees) {
        byType[e.employmentType] = (byType[e.employmentType] || 0) + 1;
      }

      const byDept: Record<string, number> = {};
      for (const e of employees) {
        const d = e.department?.name || 'Unassigned';
        byDept[d] = (byDept[d] || 0) + 1;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentJoinees = employees
        .filter(e => e.joiningDate && new Date(e.joiningDate) >= thirtyDaysAgo)
        .map(e => ({
          name: `${e.firstName} ${e.lastName}`,
          code: e.employeeCode,
          department: e.department?.name || '—',
          designation: e.designation || '—',
          joiningDate: e.joiningDate ? formatDate(e.joiningDate) : null,
        }));

      reportData = {
        summary: {
          total: employees.length,
          byEmploymentType: byType,
          byDepartment: Object.entries(byDept).map(([name, count]) => ({ name, count })),
          recentJoinees: recentJoinees.length,
          avgSalary: employees.filter(e => e.salary).length > 0
            ? employees.reduce((s, e) => s + (e.salary?.grossSalary || 0), 0) / employees.filter(e => e.salary).length
            : 0,
          totalSalaryBill: employees.reduce((s, e) => s + (e.salary?.grossSalary || 0), 0),
        },
        employeeDetails: empDetails,
        recentJoinees,
        byDepartment: Object.entries(byDept).map(([name, count]) => ({ name, count })),
      };
    }

    // ═══════════ PDF FORMAT ═══════════
    if (format === 'pdf') {
      const html = generateReportHTML(reportType, reportData, startDate, endDate);
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
    }

    // ═══════════ CSV FORMAT ═══════════
    if (format === 'csv') {
      const csv = generateCSV(reportType, reportData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}-report-${startDate || 'all'}-to-${endDate || 'now'}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      departments: departments.map(d => ({ id: d.id, name: d.name, count: d._count.employees })),
      period: { startDate: startDate || 'All Time', endDate: endDate || 'Present' },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Generate report error:', err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}

// ═══════════ CSV GENERATOR ═══════════
function generateCSV(reportType: string, data: Record<string, unknown>): string {
  const d = data as Record<string, unknown>;
  const rows: string[][] = [];

  if (reportType === 'attendance') {
    const details = (d.employeeDetails || []) as Array<Record<string, unknown>>;
    rows.push(['Employee Code', 'Name', 'Department', 'Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Avg Hours', 'Attendance %']);
    for (const e of details) {
      rows.push([
        String(e.code), String(e.name), String(e.department),
        String(e.present), String(e.absent), String(e.late), String(e.halfDay), String(e.onLeave),
        String(e.avgHours), String(e.attendanceRate) + '%',
      ]);
    }
    // Add daily records section
    const records = (d.attendanceRecords || []) as Array<Record<string, unknown>>;
    if (records.length > 0) {
      rows.push([]);
      rows.push(['--- DAILY ATTENDANCE RECORDS ---']);
      rows.push(['Date', 'Employee Code', 'Employee', 'Department', 'Check In', 'Check Out', 'Status', 'Late', 'Late Minutes', 'Work Hours', 'Shift']);
      for (const r of records) {
        const fmtTime = (iso: unknown) => {
          if (!iso) return '—';
          return new Date(String(iso)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        };
        rows.push([
          String(r.date), String(r.code), String(r.employee), String(r.department),
          fmtTime(r.checkIn), fmtTime(r.checkOut), String(r.status),
          r.isLate ? 'Yes' : 'No', String(r.lateMinutes || 0),
          String(r.workHours || 0), String(r.shiftName),
        ]);
      }
    }
  } else if (reportType === 'leave') {
    const requests = (d.recentRequests || []) as Array<Record<string, unknown>>;
    rows.push(['Employee Code', 'Employee', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Reason']);
    for (const r of requests) {
      rows.push([
        String(r.code), String(r.employee), String(r.department),
        String(r.leaveType), String(r.startDate), String(r.endDate),
        String(r.totalDays), String(r.status), String(r.reason),
      ]);
    }
    // Add leave balances section
    const balances = (d.leaveBalances || []) as Array<Record<string, unknown>>;
    if (balances.length > 0) {
      rows.push([]);
      rows.push(['--- LEAVE BALANCES ---']);
      rows.push(['Employee Code', 'Employee', 'Department', 'Leave Type', 'Allocated', 'Used', 'Pending', 'Remaining']);
      for (const emp of balances) {
        const empBals = (emp.balances as Array<Record<string, unknown>>) || [];
        for (const bal of empBals) {
          rows.push([
            String(emp.code), String(emp.name), String(emp.department),
            String(bal.leaveType), String(bal.total), String(bal.used),
            String(bal.pending), String(bal.remaining),
          ]);
        }
      }
    }
  } else if (reportType === 'payroll') {
    const details = (d.payrollDetails || []) as Array<Record<string, unknown>>;
    rows.push(['Employee Code', 'Employee', 'Department', 'Month/Year', 'Working Days', 'Present Days', 'Gross', 'Tax', 'PF', 'Late Ded.', 'Absent Ded.', 'Total Deductions', 'Net Salary', 'Status']);
    for (const p of details) {
      rows.push([
        String(p.code), String(p.employee), String(p.department),
        `${p.month}/${p.year}`, String(p.workingDays), String(p.presentDays),
        String(p.grossSalary), String(p.tds), String(p.pf),
        String(p.lateDeduction), String(p.absentDeduction),
        String(p.totalDeductions), String(p.netSalary), String(p.status),
      ]);
    }
  } else if (reportType === 'employees') {
    const details = (d.employeeDetails || []) as Array<Record<string, unknown>>;
    rows.push(['Employee Code', 'Name', 'Email', 'Phone', 'Department', 'Designation', 'Employment Type', 'Joining Date', 'Gross Salary', 'Net Salary']);
    for (const e of details) {
      rows.push([
        String(e.code), String(e.name), String(e.email), String(e.phone),
        String(e.department), String(e.designation), String(e.employmentType),
        String(e.joiningDate), String(e.grossSalary), String(e.netSalary),
      ]);
    }
  }

  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

// ═══════════ PDF HTML GENERATOR ═══════════
function generateReportHTML(reportType: string, data: Record<string, unknown>, startDate: string | null, endDate: string | null): string {
  const formatCurrency = (amount: number) => 'Rs ' + Math.round(amount || 0).toLocaleString('en-PK');
  const formatDate = (date: string | Date) => (date instanceof Date ? date : new Date(date)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const d = data as Record<string, unknown>;

  let reportContent = '';

  if (reportType === 'attendance') {
    const summary = d.summary as Record<string, unknown>;
    const details = (d.employeeDetails || []) as Array<Record<string, unknown>>;
    const total = (summary.totalRecords as number) || 1;
    reportContent = `
      <div class="section"><h2>Attendance Summary</h2>
        <div class="stats-grid">
          <div class="stat-card green"><div class="stat-value">${summary.presentDays}</div><div class="stat-label">Present</div><div class="stat-percent">${((summary.presentDays as number) / total * 100).toFixed(1)}%</div></div>
          <div class="stat-card red"><div class="stat-value">${summary.absentDays}</div><div class="stat-label">Absent</div><div class="stat-percent">${((summary.absentDays as number) / total * 100).toFixed(1)}%</div></div>
          <div class="stat-card amber"><div class="stat-value">${summary.lateDays}</div><div class="stat-label">Late</div><div class="stat-percent">${((summary.lateDays as number) / total * 100).toFixed(1)}%</div></div>
          <div class="stat-card blue"><div class="stat-value">${summary.avgWorkHours}h</div><div class="stat-label">Avg Hours</div></div>
        </div>
      </div>
      <div class="section"><h2>Employee-wise Attendance</h2>
        <table><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Avg Hrs</th><th>Rate</th></tr></thead>
        <tbody>${details.map(e => `<tr><td>${e.code}</td><td>${e.name}</td><td>${e.department}</td><td>${e.present}</td><td>${e.absent}</td><td>${e.late}</td><td>${e.halfDay}</td><td>${e.avgHours}h</td><td>${e.attendanceRate}%</td></tr>`).join('')}</tbody></table>
      </div>`;
  } else if (reportType === 'leave') {
    const summary = d.summary as Record<string, unknown>;
    const requests = (d.recentRequests || []) as Array<Record<string, unknown>>;
    reportContent = `
      <div class="section"><h2>Leave Summary</h2>
        <div class="stats-grid">
          <div class="stat-card purple"><div class="stat-value">${summary.totalRequests}</div><div class="stat-label">Total</div></div>
          <div class="stat-card green"><div class="stat-value">${summary.approved}</div><div class="stat-label">Approved</div></div>
          <div class="stat-card amber"><div class="stat-value">${summary.pending}</div><div class="stat-label">Pending</div></div>
          <div class="stat-card red"><div class="stat-value">${summary.rejected}</div><div class="stat-label">Rejected</div></div>
        </div>
      </div>
      <div class="section"><h2>Leave Requests Detail</h2>
        <table><thead><tr><th>Employee</th><th>Department</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th></tr></thead>
        <tbody>${requests.map(r => `<tr><td>${r.employee}</td><td>${r.department}</td><td>${r.leaveType}</td><td>${r.startDate}</td><td>${r.endDate}</td><td>${r.totalDays}</td><td><span class="status-${(r.status as string).toLowerCase()}">${r.status}</span></td></tr>`).join('')}</tbody></table>
      </div>`;
  } else if (reportType === 'payroll') {
    const summary = d.summary as Record<string, unknown>;
    const details = (d.payrollDetails || []) as Array<Record<string, unknown>>;
    reportContent = `
      <div class="section"><h2>Payroll Summary</h2>
        <div class="stats-grid">
          <div class="stat-card green"><div class="stat-value">${formatCurrency(summary.totalNet as number)}</div><div class="stat-label">Total Net</div></div>
          <div class="stat-card red"><div class="stat-value">${formatCurrency(summary.totalDeductions as number)}</div><div class="stat-label">Deductions</div></div>
          <div class="stat-card amber"><div class="stat-value">${formatCurrency(summary.totalTax as number)}</div><div class="stat-label">Tax</div></div>
          <div class="stat-card blue"><div class="stat-value">${formatCurrency(summary.avgSalary as number)}</div><div class="stat-label">Avg Salary</div></div>
        </div>
      </div>
      <div class="section"><h2>Payroll Detail</h2>
        <table><thead><tr><th>Code</th><th>Employee</th><th>Dept</th><th>Gross</th><th>Tax</th><th>PF</th><th>Deductions</th><th>Net</th><th>Status</th></tr></thead>
        <tbody>${details.map(p => `<tr><td>${p.code}</td><td>${p.employee}</td><td>${p.department}</td><td>${formatCurrency(p.grossSalary as number)}</td><td>${formatCurrency(p.tds as number)}</td><td>${formatCurrency(p.pf as number)}</td><td>${formatCurrency(p.totalDeductions as number)}</td><td><strong>${formatCurrency(p.netSalary as number)}</strong></td><td><span class="status-${(p.status as string).toLowerCase()}">${p.status}</span></td></tr>`).join('')}</tbody></table>
      </div>`;
  } else if (reportType === 'employees') {
    const summary = d.summary as Record<string, unknown>;
    const details = (d.employeeDetails || []) as Array<Record<string, unknown>>;
    reportContent = `
      <div class="section"><h2>Workforce Summary</h2>
        <div class="stats-grid">
          <div class="stat-card blue"><div class="stat-value">${summary.total}</div><div class="stat-label">Total Employees</div></div>
          <div class="stat-card green"><div class="stat-value">${formatCurrency(summary.totalSalaryBill as number)}</div><div class="stat-label">Monthly Bill</div></div>
          <div class="stat-card purple"><div class="stat-value">${summary.recentJoinees}</div><div class="stat-label">New Joinees (30d)</div></div>
          <div class="stat-card amber"><div class="stat-value">${formatCurrency(summary.avgSalary as number)}</div><div class="stat-label">Avg Salary</div></div>
        </div>
      </div>
      <div class="section"><h2>Employee Directory</h2>
        <table><thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Type</th><th>Joined</th><th>Gross Salary</th></tr></thead>
        <tbody>${details.map(e => `<tr><td>${e.code}</td><td>${e.name}</td><td>${e.department}</td><td>${e.designation}</td><td>${(e.employmentType as string).replace('_', ' ')}</td><td>${e.joiningDate}</td><td>${formatCurrency(e.grossSalary as number)}</td></tr>`).join('')}</tbody></table>
      </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - BMD HRMS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;line-height:1.5;color:#1e293b;background:#f8fafc;padding:30px}
.header{background:linear-gradient(135deg,#0d9488 0%,#059669 100%);color:white;padding:30px 40px;border-radius:12px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:24px;font-weight:700}.header .subtitle{opacity:0.9;margin-top:4px;font-size:14px}
.header .company{text-align:right}.header .company-name{font-size:20px;font-weight:700}
.meta{background:white;padding:16px 24px;border-radius:10px;margin-bottom:24px;display:flex;gap:30px;box-shadow:0 1px 3px rgba(0,0,0,0.08);font-size:13px}
.meta-item{display:flex;align-items:center;gap:8px}.meta-label{color:#64748b}.meta-value{font-weight:600;color:#1e293b}
.section{background:white;padding:24px;border-radius:10px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
.section h2{font-size:16px;color:#1e293b;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.stat-card{padding:20px;border-radius:10px;text-align:center}
.stat-card.green{background:#ecfdf5}.stat-card.red{background:#fef2f2}.stat-card.amber{background:#fffbeb}.stat-card.blue{background:#eff6ff}.stat-card.purple{background:#f5f3ff}
.stat-value{font-size:24px;font-weight:700;margin-bottom:4px}
.stat-card.green .stat-value{color:#059669}.stat-card.red .stat-value{color:#dc2626}.stat-card.amber .stat-value{color:#d97706}.stat-card.blue .stat-value{color:#2563eb}.stat-card.purple .stat-value{color:#7c3aed}
.stat-label{font-size:12px;color:#64748b}.stat-percent{font-size:11px;color:#94a3b8;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #e2e8f0}
th{background:#f8fafc;font-weight:600;color:#475569;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
tr:hover td{background:#f8fafc}
.status-approved,.status-paid{color:#059669;font-weight:600}.status-pending,.status-draft,.status-processed{color:#d97706;font-weight:600}.status-rejected{color:#dc2626;font-weight:600}
.footer{text-align:center;padding:24px;color:#64748b;font-size:11px}
@media print{body{padding:15px;background:white}.header{page-break-after:avoid}.section{page-break-inside:avoid}table{font-size:9px}th,td{padding:5px 6px}}
</style></head><body>
<div class="header"><div><h1>${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</h1><div class="subtitle">Comprehensive ${reportType} analysis</div></div><div class="company"><div class="company-name">BMD HRMS</div></div></div>
<div class="meta"><div class="meta-item"><span class="meta-label">Period:</span><span class="meta-value">${startDate || 'All Time'} to ${endDate || 'Present'}</span></div><div class="meta-item"><span class="meta-label">Generated:</span><span class="meta-value">${formatDate(new Date())}</span></div><div class="meta-item"><span class="meta-label">Type:</span><span class="meta-value">${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</span></div></div>
${reportContent}
<div class="footer"><p>Generated by BMD HRMS &copy; ${new Date().getFullYear()}</p></div>
</body></html>`;
}
