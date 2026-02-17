export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { formatDate, formatDateTime, parseDateUTC } from '@/lib/utils';
import type { Attendance, Department, Employee, ActivityLog, User, Holiday } from '@prisma/client';

// GET /api/dashboard/admin - Admin/HR/Manager dashboard
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    // Check permission to view admin dashboard
    const perm = await checkPermission(user!.userId, user!.role, 'dashboard', 'view_admin');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const today = new Date();
    const todayDate = formatDate(today);
    const isDepartmentScope = perm.scope === 'DEPARTMENT';

    // For DEPARTMENT scope: scope everything to their team
    let teamEmployeeIds: string[] | null = null;
    if (isDepartmentScope) {
      const mgr = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!mgr) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      const subordinates = await prisma.employee.findMany({
        where: { reportingManagerId: mgr.id, employmentStatus: 'ACTIVE' },
        select: { id: true },
      });
      teamEmployeeIds = [mgr.id, ...subordinates.map(s => s.id)];
    }

    const employeeFilter = teamEmployeeIds ? { id: { in: teamEmployeeIds } } : {};
    const attendanceFilter = teamEmployeeIds ? { employeeId: { in: teamEmployeeIds } } : {};

    // Employee stats
    const [totalEmployees, activeEmployees] = await Promise.all([
      prisma.employee.count({ where: teamEmployeeIds ? { id: { in: teamEmployeeIds } } : undefined }),
      prisma.employee.count({ where: { employmentStatus: 'ACTIVE', ...employeeFilter } }),
    ]);

    // Today's attendance stats
    const todayAttendance = await prisma.attendance.findMany({
      where: { date: parseDateUTC(todayDate), ...attendanceFilter },
    });

    const presentToday = todayAttendance.filter((a: Attendance) => ['PRESENT', 'HALF_DAY'].includes(a.status)).length;
    const onLeaveToday = todayAttendance.filter((a: Attendance) => a.status === 'ON_LEAVE').length;
    const lateToday = todayAttendance.filter((a: Attendance) => a.isLate).length;
    const absentToday = activeEmployees - presentToday - onLeaveToday;

    // Pending approvals (scoped for managers)
    const leaveFilter = teamEmployeeIds ? { status: 'PENDING' as const, employee: { id: { in: teamEmployeeIds } } } : { status: 'PENDING' as const };
    const correctionFilter = teamEmployeeIds ? { status: 'PENDING' as const, attendance: { employeeId: { in: teamEmployeeIds } } } : { status: 'PENDING' as const };
    const [pendingLeaveRequests, pendingCorrectionRequests] = await Promise.all([
      prisma.leaveRequest.count({ where: leaveFilter }),
      prisma.attendanceCorrection.count({ where: correctionFilter }),
    ]);

    // Department stats
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      include: {
        employees: {
          where: { employmentStatus: 'ACTIVE' },
          select: { id: true },
        },
      },
    });

    const departmentStats = await Promise.all(
      departments.map(async (dept: Department & { employees: { id: string }[] }) => {
        const employeeIds = dept.employees.map((e: { id: string }) => e.id);
        const presentCount = await prisma.attendance.count({
          where: {
            date: parseDateUTC(todayDate),
            employeeId: { in: employeeIds },
            status: { in: ['PRESENT', 'HALF_DAY'] },
          },
        });

        return {
          department: dept.name,
          totalEmployees: employeeIds.length,
          presentToday: presentCount,
        };
      })
    );

    // Recent activities
    const recentActivities = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Upcoming birthdays (next 7 days)
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const employees = await prisma.employee.findMany({
      where: {
        employmentStatus: 'ACTIVE',
        dateOfBirth: { not: null },
      },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        department: { select: { name: true } },
      },
    });

    const upcomingBirthdays = employees
      .filter((emp) => {
        if (!emp.dateOfBirth) return false;
        const birthMonth = emp.dateOfBirth.getMonth();
        const birthDay = emp.dateOfBirth.getDate();
        const thisYearBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        return thisYearBirthday >= today && thisYearBirthday <= sevenDaysLater;
      })
      .map((emp) => ({
        id: `${emp.firstName}-${emp.lastName}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        name: `${emp.firstName} ${emp.lastName}`,
        date: formatDate(new Date(today.getFullYear(), emp.dateOfBirth!.getMonth(), emp.dateOfBirth!.getDate())),
        department: emp.department?.name,
      }))
      .slice(0, 5);

    // Upcoming holidays
    const upcomingHolidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: today,
        },
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          onLeaveToday,
          presentToday,
          absentToday,
          lateToday,
        },
        pendingApprovals: {
          leaveRequests: pendingLeaveRequests,
          correctionRequests: pendingCorrectionRequests,
        },
        departmentStats,
        recentActivities: recentActivities.map((a: ActivityLog & { user: User & { employee: { firstName: string, lastName: string } | null } }) => ({
          id: a.id,
          action: a.action,
          description: a.description,
          createdAt: a.createdAt,
          user: { 
            email: a.user.email,
            name: a.user.employee 
              ? `${a.user.employee.firstName} ${a.user.employee.lastName}` 
              : a.user.email 
          },
          timestamp: formatDateTime(a.createdAt),
        })),
        upcomingBirthdays,
        upcomingHolidays: upcomingHolidays.map((h: Holiday) => ({
          id: h.id,
          name: h.name,
          date: h.date,
        })),
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
