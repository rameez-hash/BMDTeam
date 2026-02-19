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
    let records = attendanceRecords.map(record => {
      const isOnBreak = record.breaks.some(b => !b.endTime);
      return {
        id: record.id,
        date: record.date.toISOString(),
        checkIn: record.checkIn?.toISOString(),
        checkOut: record.checkOut?.toISOString(),
        status: record.status,
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
          department: { select: { name: true } },
          shift: { select: { name: true, startTime: true, endTime: true, workDays: true } },
        },
      });

      // Generate weekend and holiday dates per employee based on their shift workDays
      for (const emp of allEmployees) {
        const empWorkDays = getWorkDays(emp.shift?.workDays);
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dayOfWeek = currentDate.getDay();
          const dateStr = formatDate(currentDate);
          const existingRecord = records.find(
            r => r.employee?.id === emp.id && formatDate(new Date(r.date)) === dateStr
          );
          if (!existingRecord) {
            let specialType: 'WEEKEND' | 'HOLIDAY' | null = null;
            let holidayName: string | undefined;
            if (!empWorkDays.includes(dayOfWeek)) {
              specialType = 'WEEKEND';
            } else if (holidayMap.has(dateStr)) {
              specialType = 'HOLIDAY';
              holidayName = holidayMap.get(dateStr);
            }
            if (specialType) {
              records.push({
                id: `${specialType.toLowerCase()}-${emp.id}-${dateStr}`,
                date: new Date(currentDate).toISOString(),
                checkIn: undefined,
                checkOut: undefined,
                status: specialType,
                workHours: null,
                workLocation: null,
                isLate: false,
                lateMinutes: 0,
                isOnBreak: false,
                shiftName: null,
                shiftStartTime: null,
                shiftEndTime: null,
                breaks: [],
                employee: {
                  id: emp.id,
                  firstName: emp.firstName,
                  lastName: emp.lastName,
                  employeeCode: emp.employeeCode,
                  profileImage: emp.profileImage,
                  department: emp.department,
                  shift: emp.shift,
                },
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
      late: records.filter(r => r.isLate).length,
      absent: records.filter(r => r.status === 'ABSENT').length,
      onLeave: records.filter(r => r.status === 'ON_LEAVE').length,
      weekend: records.filter(r => r.status === 'WEEKEND').length,
      holiday: records.filter(r => r.status === 'HOLIDAY').length,
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
