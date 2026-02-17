export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { formatDate, parseDateUTC } from '@/lib/utils';

// GET /api/holidays - List holidays
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const holidays = await prisma.holiday.findMany({
      where: { year },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: holidays,
    });
  } catch (error) {
    console.error('Get holidays error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/holidays - Create holiday
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'holidays', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { name, date, type, isOptional, description, year } = body;

    if (!name || !date || !year) {
      return NextResponse.json(
        { error: 'Name, date, and year are required' },
        { status: 400 }
      );
    }

    const holidayDate = parseDateUTC(date);
    const holiday = await prisma.holiday.create({
      data: {
        name,
        date: holidayDate,
        type: type || 'PUBLIC',
        isOptional: isOptional || false,
        description,
        year,
      },
    });

    const activeEmployees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: { id: true },
    });

    if (activeEmployees.length > 0) {
      await prisma.attendance.createMany({
        data: activeEmployees.map(emp => ({
          employeeId: emp.id,
          date: holidayDate,
          status: 'HOLIDAY',
          isLate: false,
          lateMinutes: 0,
          notes: `Holiday: ${name}`,
          modifiedById: user!.employeeDbId || null,
          modifiedAt: new Date(),
          modifyReason: 'Auto-mark holiday',
        })),
        skipDuplicates: true,
      });
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          userId: u.id,
          title: `New Holiday: ${name}`,
          message: `${name} on ${formatDate(holidayDate)}`,
          type: 'INFO',
          module: 'holidays',
          resourceId: holiday.id,
          link: '/dashboard/holidays',
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: holiday,
    }, { status: 201 });
  } catch (error) {
    console.error('Create holiday error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/holidays - Update holiday
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'holidays', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, date, type, isOptional, description } = body;

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    const nextDate = date ? parseDateUTC(date) : existing.date;
    const dateChanged = date ? formatDate(existing.date) !== formatDate(nextDate) : false;

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(date && { date: nextDate }),
        ...(type && { type }),
        ...(isOptional !== undefined && { isOptional }),
        ...(description !== undefined && { description }),
      },
    });

    if (dateChanged) {
      await prisma.attendance.deleteMany({
        where: { date: existing.date, status: 'HOLIDAY' },
      });

      const activeEmployees = await prisma.employee.findMany({
        where: { employmentStatus: 'ACTIVE' },
        select: { id: true },
      });

      if (activeEmployees.length > 0) {
        await prisma.attendance.createMany({
          data: activeEmployees.map(emp => ({
            employeeId: emp.id,
            date: nextDate,
            status: 'HOLIDAY',
            isLate: false,
            lateMinutes: 0,
            notes: `Holiday: ${name || existing.name}`,
            modifiedById: user!.employeeDbId || null,
            modifiedAt: new Date(),
            modifyReason: 'Auto-mark holiday',
          })),
          skipDuplicates: true,
        });
      }
    }

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          userId: u.id,
          title: `Holiday Updated: ${holiday.name}`,
          message: `${holiday.name} on ${formatDate(holiday.date)}`,
          type: 'INFO',
          module: 'holidays',
          resourceId: holiday.id,
          link: '/dashboard/holidays',
        })),
      });
    }

    return NextResponse.json({ success: true, data: holiday });
  } catch (error) {
    console.error('Update holiday error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/holidays - Delete holiday
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'holidays', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Holiday ID required' }, { status: 400 });
    }

    const existing = await prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Holiday not found' }, { status: 404 });
    }

    await prisma.holiday.delete({ where: { id } });

    await prisma.attendance.deleteMany({
      where: { date: existing.date, status: 'HOLIDAY' },
    });

    const activeUsers = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          userId: u.id,
          title: `Holiday Removed: ${existing.name}`,
          message: `${existing.name} on ${formatDate(existing.date)} removed`,
          type: 'INFO',
          module: 'holidays',
          resourceId: id,
          link: '/dashboard/holidays',
        })),
      });
    }

    return NextResponse.json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
