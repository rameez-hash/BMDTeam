export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { getPaginationParams, formatDate, calculateLateArrival, calculateWorkHours, getWorkDays, parseDateUTC, getDateStringPKT } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';

// GET /api/attendance - List attendance records
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (startDate && endDate) {
      where.date = {
        gte: parseDateUTC(startDate),
        lte: parseDateUTC(endDate),
      };
    } else if (startDate) {
      where.date = { gte: parseDateUTC(startDate) };
    } else if (endDate) {
      where.date = { lte: parseDateUTC(endDate) };
    }

    if (status) where.status = status;

    // Dynamic permission-based filtering
    const permResult = await checkPermission(user!.userId, user!.role, 'attendance', 'view');
    
    if (!permResult.allowed || permResult.scope === 'SELF') {
      // SELF scope or no permission: only own records
      where.employee = { userId: user!.userId };
    } else if (permResult.scope === 'DEPARTMENT') {
      // DEPARTMENT scope: see all employees in the same department
      if (employeeId) {
        // Verify the employee is in the same department
        const emp = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { departmentId: true },
        });
        if (emp?.departmentId && emp.departmentId === user!.departmentId) {
          where.employeeId = employeeId;
        } else {
          // Not in same department, only show own
          where.employee = { userId: user!.userId };
        }
      } else {
        // Show all employees in same department
        where.employee = { departmentId: user!.departmentId };
      }
    } else {
      // ALL scope: see everyone
      if (employeeId) {
        where.employeeId = employeeId;
      }
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
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
              department: { select: { name: true } },
              shift: { select: { name: true, startTime: true, endTime: true, graceTime: true, standardWorkHours: true, breakDuration: true } },
            },
          },
          breaks: true,
        },
        orderBy: { date: 'desc' },
      }),
      prisma.attendance.count({ where }),
    ]);

    // Generate weekend, holiday AND absent records for the date range if needed
    const specialRecords: Array<{
      id: string;
      date: Date;
      checkIn: null;
      checkOut: null;
      status: 'WEEKEND' | 'HOLIDAY' | 'ABSENT' | 'NOT_JOINED';
      isLate: boolean;
      lateMinutes: number;
      workHours: null;
      overtime: null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
      employeeId: string;
      employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        department: { name: string } | null;
      };
      breaks: never[];
    }> = [];
    
    if (startDate && endDate) {
      const start = parseDateUTC(startDate);
      const end = parseDateUTC(endDate);
      
      // Fetch holidays in range
      const holidays = await prisma.holiday.findMany({
        where: { date: { gte: start, lte: end } },
      });
      const holidayMap = new Map<string, string>();
      holidays.forEach(h => {
        holidayMap.set(formatDate(h.date), h.name);
      });

      // Build employee filter based on same permission scope
      let empWhere: Record<string, unknown> = {};
      if (!permResult.allowed || permResult.scope === 'SELF') {
        empWhere = { userId: user!.userId };
      } else if (permResult.scope === 'DEPARTMENT') {
        empWhere = employeeId 
          ? { id: employeeId, departmentId: user!.departmentId }
          : { departmentId: user!.departmentId };
      } else {
        // ALL scope
        empWhere = employeeId ? { id: employeeId } : {};
      }
      
      const allEmployees = await prisma.employee.findMany({
        where: empWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          joiningDate: true,
          attendanceStartDate: true,
          department: { select: { name: true } },
          shift: { select: { workDays: true } },
        },
      });

      // Generate weekend and holiday dates in the range per employee (respecting their shift workDays)
      for (const emp of allEmployees) {
        const empWorkDays = getWorkDays(emp.shift?.workDays);
        // Use attendanceStartDate if set, otherwise fall back to joiningDate
        const empJoinDate = emp.attendanceStartDate
          ? new Date(emp.attendanceStartDate)
          : emp.joiningDate ? new Date(emp.joiningDate) : null;
        
        // Generate NOT_JOINED records for dates before joining date
        if (empJoinDate && empJoinDate > start) {
          const preJoinDate = new Date(start);
          const preJoinEnd = new Date(empJoinDate);
          preJoinEnd.setDate(preJoinEnd.getDate() - 1); // day before joining
          while (preJoinDate <= preJoinEnd && preJoinDate <= end) {
            const dateStr = formatDate(preJoinDate);
            const existingRecord = attendance.find(
              a => a.employeeId === emp.id && formatDate(a.date) === dateStr
            );
            if (!existingRecord) {
              specialRecords.push({
                id: `notjoined-${emp.id}-${dateStr}`,
                employeeId: emp.id,
                date: new Date(preJoinDate),
                checkIn: null,
                checkOut: null,
                status: 'NOT_JOINED',
                isLate: false,
                lateMinutes: 0,
                workHours: null,
                overtime: null,
                notes: 'Not yet joined',
                createdAt: new Date(preJoinDate),
                updatedAt: new Date(preJoinDate),
                employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode, department: emp.department },
                breaks: [],
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
          const existingRecord = attendance.find(
            a => a.employeeId === emp.id && formatDate(a.date) === dateStr
          );
          if (!existingRecord) {
            if (!empWorkDays.includes(dayOfWeek)) {
              specialRecords.push({
                id: `weekend-${emp.id}-${dateStr}`,
                employeeId: emp.id,
                date: new Date(currentDate),
                checkIn: null,
                checkOut: null,
                status: 'WEEKEND',
                isLate: false,
                lateMinutes: 0,
                workHours: null,
                overtime: null,
                notes: null,
                createdAt: new Date(currentDate),
                updatedAt: new Date(currentDate),
                employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode, department: emp.department },
                breaks: [],
              });
            } else if (holidayMap.has(dateStr)) {
              specialRecords.push({
                id: `holiday-${emp.id}-${dateStr}`,
                employeeId: emp.id,
                date: new Date(currentDate),
                checkIn: null,
                checkOut: null,
                status: 'HOLIDAY',
                isLate: false,
                lateMinutes: 0,
                workHours: null,
                overtime: null,
                notes: `Holiday: ${holidayMap.get(dateStr)}`,
                createdAt: new Date(currentDate),
                updatedAt: new Date(currentDate),
                employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode, department: emp.department },
                breaks: [],
              });
            } else {
              // Past working day with no record = ABSENT
              const today = parseDateUTC(getDateStringPKT(new Date()));
              if (new Date(currentDate) < today) {
                specialRecords.push({
                  id: `absent-${emp.id}-${dateStr}`,
                  employeeId: emp.id,
                  date: new Date(currentDate),
                  checkIn: null,
                  checkOut: null,
                  status: 'ABSENT',
                  isLate: false,
                  lateMinutes: 0,
                  workHours: null,
                  overtime: null,
                  notes: null,
                  createdAt: new Date(currentDate),
                  updatedAt: new Date(currentDate),
                  employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, employeeCode: emp.employeeCode, department: emp.department },
                  breaks: [],
                });
              }
            }
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    // Combine attendance records with special records and sort by date
    const allRecords = [...attendance, ...specialRecords].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Apply pagination
    const paginatedRecords = allRecords.slice(skip, skip + limit);
    const totalWithWeekends = allRecords.length;

    return NextResponse.json({
      success: true,
      data: paginatedRecords,
      pagination: {
        page,
        limit,
        total: totalWithWeekends,
        totalPages: Math.ceil(totalWithWeekends / limit),
      },
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/attendance?id=... - Delete attendance record
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const deletePerm = await checkPermission(user.userId, user.role, 'attendance', 'manage');
    if (!deletePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Attendance id is required' }, { status: 400 });
    }

    if (id.startsWith('weekend-')) {
      return NextResponse.json({ error: 'Weekend records cannot be deleted' }, { status: 400 });
    }

    // BLOCK SELF-EDIT: No one (except ADMIN) can delete their own attendance
    if (user.role !== 'ADMIN') {
      const record = await prisma.attendance.findUnique({ where: { id }, select: { employeeId: true } });
      if (record && record.employeeId === user.employeeDbId) {
        return NextResponse.json(
          { error: 'You cannot delete your own attendance record' },
          { status: 403 }
        );
      }
    }

    // Fetch the record first to check if it's ON_LEAVE
    const attendanceRecord = await prisma.attendance.findUnique({
      where: { id },
      select: { id: true, employeeId: true, date: true, status: true },
    });

    if (!attendanceRecord) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // If status is ON_LEAVE, restore the leave balance and cancel the leave request
    if (attendanceRecord.status === 'ON_LEAVE') {
      // Find the approved leave request that covers this date
      const leaveRequest = await prisma.leaveRequest.findFirst({
        where: {
          employeeId: attendanceRecord.employeeId,
          status: 'APPROVED',
          startDate: { lte: attendanceRecord.date },
          endDate: { gte: attendanceRecord.date },
        },
        select: { id: true, leaveTypeId: true, totalDays: true, startDate: true, endDate: true },
      });

      if (leaveRequest) {
        // Restore 1 day to leave balance
        const year = attendanceRecord.date.getFullYear();
        await prisma.leaveBalance.updateMany({
          where: {
            employeeId: attendanceRecord.employeeId,
            leaveTypeId: leaveRequest.leaveTypeId,
            year: year,
          },
          data: {
            usedDays: { decrement: 1 },
          },
        });

        // Check how many ON_LEAVE records remain for this leave request
        const remainingOnLeave = await prisma.attendance.count({
          where: {
            employeeId: attendanceRecord.employeeId,
            status: 'ON_LEAVE',
            date: { gte: leaveRequest.startDate, lte: leaveRequest.endDate },
            id: { not: attendanceRecord.id }, // exclude the one being deleted
          },
        });

        // If no more ON_LEAVE records remain, cancel the leave request
        if (remainingOnLeave === 0) {
          await prisma.leaveRequest.update({
            where: { id: leaveRequest.id },
            data: { status: 'CANCELLED' },
          });
        }
      }
    }

    // Delete related breaks first
    await prisma.attendanceBreak.deleteMany({ where: { attendanceId: id } });
    
    await prisma.attendance.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Attendance record deleted' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/attendance - Update/Modify attendance record
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updatePerm = await checkPermission(user.userId, user.role, 'attendance', 'manage');
    if (!updatePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { id, checkIn, checkOut, status, isLate, lateMinutes, workHours, overtime, notes, workLocation, modifyReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'Attendance id is required' }, { status: 400 });
    }

    if (id.startsWith('weekend-')) {
      return NextResponse.json({ error: 'Weekend records cannot be modified' }, { status: 400 });
    }

    // Get existing attendance with employee + shift for recalculation
    const existing = await prisma.attendance.findUnique({
      where: { id },
      include: { employee: { include: { shift: true } }, breaks: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    // BLOCK SELF-EDIT: No one (except ADMIN) can edit their own attendance
    if (user.role !== 'ADMIN' && existing.employeeId === user.employeeDbId) {
      return NextResponse.json(
        { error: 'You cannot edit your own attendance record' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      modifiedById: user.employeeDbId,
      modifiedAt: new Date(),
    };
    
    if (modifyReason) {
      updateData.modifyReason = modifyReason;
    }
    
    if (checkIn !== undefined) {
      updateData.checkIn = checkIn ? new Date(checkIn) : null;
    }
    if (checkOut !== undefined) {
      updateData.checkOut = checkOut ? new Date(checkOut) : null;
    }
    if (status !== undefined) {
      updateData.status = status;
      // For leave/absent/holiday/weekend — clear time-based fields
      if (['ON_LEAVE', 'ABSENT', 'HOLIDAY', 'WEEKEND'].includes(status)) {
        updateData.checkIn = null;
        updateData.checkOut = null;
        updateData.workHours = null;
        updateData.overtime = 0;
        updateData.isLate = false;
        updateData.lateMinutes = 0;
      }
    }
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }
    if (workLocation !== undefined) {
      updateData.workLocation = workLocation || null;
    }

    // Auto-recalculate late/early when check-in is changed (unless admin explicitly overrides)
    const finalCheckIn = updateData.checkIn !== undefined ? updateData.checkIn as Date | null : existing.checkIn;
    const finalCheckOut = updateData.checkOut !== undefined ? updateData.checkOut as Date | null : existing.checkOut;
    const shift = existing.employee.shift;

    if (finalCheckIn && shift && isLate === undefined) {
      // Admin didn't explicitly set isLate, so recalculate from shift
      const dateStr = formatDate(existing.date);
      const lateInfo = calculateLateArrival(finalCheckIn, shift.startTime, shift.endTime, shift.graceTime, dateStr);
      updateData.isLate = lateInfo.isLate;
      updateData.lateMinutes = lateInfo.lateMinutes;
    } else {
      // Admin explicitly set the values
      if (isLate !== undefined) updateData.isLate = isLate;
      if (lateMinutes !== undefined) updateData.lateMinutes = parseInt(lateMinutes) || 0;
    }

    // Auto-recalculate work hours from check-in/check-out (unless admin explicitly overrides)
    if (finalCheckIn && finalCheckOut && workHours === undefined) {
      const totalBreakMins = existing.breaks.reduce((total, brk) => {
        if (brk.startTime && brk.endTime) {
          return total + Math.round((brk.endTime.getTime() - brk.startTime.getTime()) / 60000);
        }
        return total;
      }, 0);
      updateData.workHours = calculateWorkHours(finalCheckIn, finalCheckOut, totalBreakMins);
    } else if (workHours !== undefined) {
      updateData.workHours = parseFloat(workHours) || 0;
    }

    if (overtime !== undefined) {
      updateData.overtime = parseFloat(overtime) || 0;
    }

    // Update shift snapshot if shift exists
    if (shift) {
      updateData.shiftName = shift.name;
      updateData.shiftStartTime = shift.startTime;
      updateData.shiftEndTime = shift.endTime;
      updateData.shiftBreakDuration = shift.breakDuration;
      updateData.shiftGraceTime = shift.graceTime;
      updateData.shiftStandardWorkHours = shift.standardWorkHours;
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        breaks: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance record updated',
      data: updated,
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/attendance - Create attendance record
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const createPerm = await checkPermission(user.userId, user.role, 'attendance', 'manage');
    if (!createPerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId, date, checkIn, checkOut, status, isLate, lateMinutes, notes, workLocation } = body;

    // BLOCK SELF-EDIT: No one (except ADMIN) can create attendance for themselves
    if (user.role !== 'ADMIN' && employeeId === user.employeeDbId) {
      return NextResponse.json(
        { error: 'You cannot create attendance records for yourself' },
        { status: 403 }
      );
    }

    if (!employeeId || !date) {
      return NextResponse.json({ error: 'Employee ID and date are required' }, { status: 400 });
    }

    // Fetch employee with their shift for snapshot
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if attendance already exists for this employee and date
    const existingAttendance = await prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: parseDateUTC(date),
        },
      },
    });

    if (existingAttendance) {
      return NextResponse.json({ error: 'Attendance record already exists for this date' }, { status: 400 });
    }

    // Calculate work hours (subtract breaks = 0 for new records)
    // No work hours for leave/absent/holiday
    let workHours = 0;
    const noTimeStatus = ['ON_LEAVE', 'ABSENT', 'HOLIDAY', 'WEEKEND'].includes(status || 'PRESENT');
    if (!noTimeStatus && checkIn && checkOut) {
      workHours = calculateWorkHours(new Date(checkIn), new Date(checkOut), 0);
    }

    // Auto-calculate late/early from shift (unless admin explicitly overrides)
    let computedIsLate = false;
    let computedLateMinutes = 0;
    if (checkIn && employee.shift && isLate === undefined) {
      const dateStr = formatDate(parseDateUTC(date));
      const lateInfo = calculateLateArrival(
        new Date(checkIn), employee.shift.startTime, employee.shift.endTime, employee.shift.graceTime, dateStr
      );
      computedIsLate = lateInfo.isLate;
      computedLateMinutes = lateInfo.lateMinutes;
    } else {
      computedIsLate = isLate || false;
      computedLateMinutes = parseInt(lateMinutes) || 0;
    }

    // Build shift snapshot from current employee shift
    const shiftSnapshot = employee.shift ? {
      shiftName: employee.shift.name,
      shiftStartTime: employee.shift.startTime,
      shiftEndTime: employee.shift.endTime,
      shiftBreakDuration: employee.shift.breakDuration,
      shiftGraceTime: employee.shift.graceTime,
      shiftStandardWorkHours: employee.shift.standardWorkHours,
    } : {};

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        date: parseDateUTC(date),
        checkIn: noTimeStatus ? null : (checkIn ? new Date(checkIn) : null),
        checkOut: noTimeStatus ? null : (checkOut ? new Date(checkOut) : null),
        status: status || 'PRESENT',
        isLate: noTimeStatus ? false : computedIsLate,
        lateMinutes: noTimeStatus ? 0 : computedLateMinutes,
        workHours: noTimeStatus ? null : workHours,
        notes: notes || null,
        workLocation: workLocation || 'OFFICE',
        modifiedById: user.employeeDbId,
        modifiedAt: new Date(),
        modifyReason: 'Created by admin',
        ...shiftSnapshot,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            department: { select: { name: true } },
          },
        },
        breaks: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Attendance record created',
      data: attendance,
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
