export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { formatDate, getWorkDays, parseDateUTC, getDateStringPKT } from '@/lib/utils';

// GET /api/attendance/monitor - Attendance records for admin/HR with filtering
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'attendance', 'manage');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');

    // Build attendance where clause
    const attendanceWhere: Record<string, unknown> = {};

    // Date filtering
    if (date) {
      attendanceWhere.date = parseDateUTC(date);
    } else if (startDate || endDate) {
      attendanceWhere.date = {};
      if (startDate) {
        (attendanceWhere.date as Record<string, Date>).gte = parseDateUTC(startDate);
      }
      if (endDate) {
        (attendanceWhere.date as Record<string, Date>).lte = parseDateUTC(endDate);
      }
    } else {
      // Default to today if no date specified
      attendanceWhere.date = parseDateUTC(getDateStringPKT(new Date()));
    }

    // Employee filtering
    if (employeeId) {
      attendanceWhere.employeeId = employeeId;
    }

    // Status filtering
    if (status) {
      attendanceWhere.status = status;
    }

    // Department filtering - need to get employee IDs from department
    if (departmentId) {
      const deptEmployees = await prisma.employee.findMany({
        where: { departmentId, employmentStatus: 'ACTIVE' },
        select: { id: true },
      });
      attendanceWhere.employeeId = { in: deptEmployees.map(e => e.id) };
    }

    // Fetch attendance records with employee details
    const attendanceRecords = await prisma.attendance.findMany({
      where: attendanceWhere,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            profileImage: true,
            department: { select: { name: true } },
            shift: { select: { name: true, startTime: true, endTime: true, workDays: true } },
          },
        },
        breaks: true,
      },
      orderBy: { date: 'desc' },
    });

    // Transform to the expected format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[] = attendanceRecords.map(record => {
      const isOnBreak = record.breaks.some(b => !b.endTime);
      return {
        id: record.id,
        date: record.date.toISOString(),
        checkIn: record.checkIn?.toISOString(),
        checkOut: record.checkOut?.toISOString(),
        status: record.status as string,
        workHours: record.workHours,
        workLocation: record.workLocation,
        isLate: record.isLate,
        lateMinutes: record.lateMinutes,
        isOnBreak,
        shiftName: record.shiftName,
        shiftStartTime: record.shiftStartTime,
        shiftEndTime: record.shiftEndTime,
        breaks: record.breaks.map(b => ({
          id: b.id,
          startTime: b.startTime.toISOString(),
          endTime: b.endTime?.toISOString(),
          duration: b.duration,
          reason: b.reason,
        })),
        employee: record.employee ? {
          id: record.employee.id,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          employeeCode: record.employee.employeeCode,
          profileImage: record.employee.profileImage,
          department: record.employee.department,
          shift: record.employee.shift,
        } : null,
      };
    });

    // Generate weekend AND holiday records for the date range
    if (startDate || endDate || date) {
      const start = date ? parseDateUTC(date) : startDate ? parseDateUTC(startDate) : parseDateUTC(getDateStringPKT(new Date()));
      const end = date ? parseDateUTC(date) : endDate ? parseDateUTC(endDate) : parseDateUTC(getDateStringPKT(new Date()));
      
      // Fetch holidays in range
      const holidays = await prisma.holiday.findMany({
        where: {
          date: { gte: start, lte: end },
        },
      });
      const holidayMap = new Map<string, string>();
      holidays.forEach(h => {
        holidayMap.set(formatDate(h.date), h.name);
      });

      // Get all active employees
      const allEmployees = await prisma.employee.findMany({
        where: {
          employmentStatus: 'ACTIVE',
          user: { role: { not: 'ADMIN' } },
          ...(employeeId ? { id: employeeId } : {}),
          ...(departmentId ? { departmentId } : {}),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          profileImage: true,
          joiningDate: true,
          attendanceStartDate: true,
          department: { select: { name: true } },
          shift: { select: { name: true, startTime: true, endTime: true, workDays: true } },
        },
      });

      const today = parseDateUTC(getDateStringPKT(new Date()));

      // Generate weekend, holiday, ABSENT, and NOT_JOINED records per employee
      for (const emp of allEmployees) {
        const empWorkDays = getWorkDays(emp.shift?.workDays);
        const empJoinDate = emp.attendanceStartDate
          ? new Date(emp.attendanceStartDate)
          : emp.joiningDate ? new Date(emp.joiningDate) : null;

        const empData = {
          id: emp.id,
          firstName: emp.firstName,
          lastName: emp.lastName,
          employeeCode: emp.employeeCode,
          profileImage: emp.profileImage,
          department: emp.department,
          shift: emp.shift,
        };

        // Generate NOT_JOINED records for dates before employee's effective start date
        if (empJoinDate && empJoinDate > start) {
          const preJoinDate = new Date(start);
          const preJoinEnd = new Date(empJoinDate);
          preJoinEnd.setDate(preJoinEnd.getDate() - 1);
          while (preJoinDate <= preJoinEnd && preJoinDate <= end) {
            const dateStr = formatDate(preJoinDate);
            const existingRecord = records.find(
              r => r.employee?.id === emp.id && formatDate(new Date(r.date)) === dateStr
            );
            if (!existingRecord) {
              records.push({
                id: `notjoined-${emp.id}-${dateStr}`,
                date: new Date(preJoinDate).toISOString(),
                checkIn: undefined,
                checkOut: undefined,
                status: 'NOT_JOINED',
                workHours: null,
                workLocation: null,
                isLate: false,
                lateMinutes: 0,
                isOnBreak: false,
                shiftName: null,
                shiftStartTime: null,
                shiftEndTime: null,
                breaks: [],
                employee: empData,
              });
            }
            preJoinDate.setDate(preJoinDate.getDate() + 1);
          }
        }

        const rangeStart = empJoinDate && empJoinDate > start ? empJoinDate : start;
        const currentDate = new Date(rangeStart);
        while (currentDate <= end) {
          const dayOfWeek = currentDate.getDay();
          const dateStr = formatDate(currentDate);
          const existingRecord = records.find(
            r => r.employee?.id === emp.id && formatDate(new Date(r.date)) === dateStr
          );
          if (!existingRecord) {
            if (!empWorkDays.includes(dayOfWeek)) {
              records.push({
                id: `weekend-${emp.id}-${dateStr}`,
                date: new Date(currentDate).toISOString(),
                checkIn: undefined,
                checkOut: undefined,
                status: 'WEEKEND',
                workHours: null,
                workLocation: null,
                isLate: false,
                lateMinutes: 0,
                isOnBreak: false,
                shiftName: null,
                shiftStartTime: null,
                shiftEndTime: null,
                breaks: [],
                employee: empData,
              });
            } else if (holidayMap.has(dateStr)) {
              records.push({
                id: `holiday-${emp.id}-${dateStr}`,
                date: new Date(currentDate).toISOString(),
                checkIn: undefined,
                checkOut: undefined,
                status: 'HOLIDAY',
                workHours: null,
                workLocation: null,
                isLate: false,
                lateMinutes: 0,
                isOnBreak: false,
                shiftName: null,
                shiftStartTime: null,
                shiftEndTime: null,
                breaks: [],
                employee: empData,
              });
            } else if (new Date(currentDate) < today) {
              // Past working day with no record = ABSENT
              records.push({
                id: `absent-${emp.id}-${dateStr}`,
                date: new Date(currentDate).toISOString(),
                checkIn: undefined,
                checkOut: undefined,
                status: 'ABSENT',
                workHours: null,
                workLocation: null,
                isLate: false,
                lateMinutes: 0,
                isOnBreak: false,
                shiftName: null,
                shiftStartTime: null,
                shiftEndTime: null,
                breaks: [],
                employee: empData,
              });
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

    }

    // Sort by date descending
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Calculate stats
    const stats = {
      total: records.length,
      present: records.filter(r => r.status === 'PRESENT').length,
      halfDay: records.filter(r => r.status === 'HALF_DAY').length,
      late: records.filter(r => r.isLate).length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      onLeave: records.filter(r => r.status === 'ON_LEAVE').length,
      weekend: records.filter(r => r.status === 'WEEKEND').length,
      holiday: records.filter(r => r.status === 'HOLIDAY').length,
      notJoined: records.filter(r => r.status === 'NOT_JOINED').length,
      totalHours: records.reduce((sum, r) => sum + (r.workHours || 0), 0),
    };

    return NextResponse.json({
      success: true,
      data: records,
      stats,
    });
  } catch (error) {
    console.error('Monitor attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
