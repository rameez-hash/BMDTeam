export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { formatDate, calculateTotalBreakMinutes } from '@/lib/utils';

// GET /api/dashboard/employee - Employee dashboard
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const employee = await prisma.employee.findFirst({
      where: { userId: user!.userId },
      include: {
        department: true,
        salary: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const today = new Date();
    const todayDate = formatDate(today);
    const year = today.getFullYear();

    // Get today's attendance
    const todayAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: new Date(todayDate),
        },
      },
      include: { breaks: true },
    });

    const isOnBreak = todayAttendance?.breaks.some(b => !b.endTime) || false;
    const totalBreakMinutes = todayAttendance?.breaks ? 
      calculateTotalBreakMinutes(todayAttendance.breaks.map(b => ({
        startTime: b.startTime,
        endTime: b.endTime,
      }))) : 0;

    let workHours = todayAttendance?.workHours || 0;
    if (todayAttendance?.checkIn && !todayAttendance.checkOut) {
      workHours = (Date.now() - todayAttendance.checkIn.getTime()) / (1000 * 60 * 60) - (totalBreakMinutes / 60);
    }

    // Get leave balance
    const leaveBalances = await prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, year },
      include: { leaveType: true },
    });

    // Get pending requests count
    const [pendingLeave, pendingCorrections] = await Promise.all([
      prisma.leaveRequest.count({
        where: { employeeId: employee.id, status: 'PENDING' },
      }),
      prisma.attendanceCorrection.count({
        where: { employeeId: employee.id, status: 'PENDING' },
      }),
    ]);

    // Get recent attendance (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttendance = await prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: sevenDaysAgo, lte: new Date(todayDate) },
      },
      orderBy: { date: 'desc' },
      take: 7,
    });

    // Get upcoming holidays
    const upcomingHolidays = await prisma.holiday.findMany({
      where: {
        date: { gte: today },
        year: today.getFullYear(),
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    // Get recent announcements
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        publishDate: { lte: today },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: today } },
        ],
      },
      orderBy: [{ priority: 'desc' }, { publishDate: 'desc' }],
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          employeeCode: employee.employeeCode,
          department: employee.department?.name,
          designation: employee.designation,
          profileImage: employee.profileImage,
        },
        salary: employee.salary ? {
          grossSalary: employee.salary.grossSalary,
          netSalary: employee.salary.netSalary,
          tds: employee.salary.tds,
          pf: employee.salary.pf,
        } : null,
        todayAttendance: {
          checkIn: todayAttendance?.checkIn,
          checkOut: todayAttendance?.checkOut,
          status: todayAttendance?.status || 'NOT_MARKED',
          workHours: Math.round(workHours * 100) / 100,
          isOnBreak,
          isLate: todayAttendance?.isLate || false,
        },
        leaveBalance: leaveBalances.map(lb => ({
          leaveType: lb.leaveType.name,
          totalDays: lb.totalDays,
          usedDays: lb.usedDays,
          remainingDays: lb.totalDays - lb.usedDays - lb.pendingDays,
        })),
        pendingRequests: {
          leaveRequests: pendingLeave,
          correctionRequests: pendingCorrections,
        },
        recentAttendance: recentAttendance.map(a => ({
          date: formatDate(a.date),
          checkIn: a.checkIn,
          checkOut: a.checkOut,
          status: a.status,
        })),
        upcomingHolidays: upcomingHolidays.map(h => ({
          name: h.name,
          date: formatDate(h.date),
          type: h.type,
        })),
        announcements: announcements.map(a => ({
          id: a.id,
          title: a.title,
          content: a.content.substring(0, 200) + (a.content.length > 200 ? '...' : ''),
          publishDate: formatDate(a.publishDate),
          priority: a.priority,
        })),
      },
    });
  } catch (error) {
    console.error('Employee dashboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
