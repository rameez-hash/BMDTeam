export const dynamic = 'force-dynamic';

import { formatDate } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';

// GET /api/announcements/birthdays - Get upcoming birthdays
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Get employees with birthdays in the next N days
    const employees = await prisma.employee.findMany({
      where: {
        employmentStatus: 'ACTIVE',
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        profileImage: true,
        department: { select: { name: true } },
      },
    });

    const upcomingBirthdays = employees
      .filter(emp => {
        if (!emp.dateOfBirth) return false;
        
        const birthMonth = emp.dateOfBirth.getMonth() + 1;
        const birthDay = emp.dateOfBirth.getDate();
        
        // Calculate days until birthday
        const thisYearBirthday = new Date(today.getFullYear(), birthMonth - 1, birthDay);
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntil <= days;
      })
      .map(emp => {
        const birthMonth = emp.dateOfBirth!.getMonth() + 1;
        const birthDay = emp.dateOfBirth!.getDate();
        const thisYearBirthday = new Date(today.getFullYear(), birthMonth - 1, birthDay);
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }
        const daysUntil = Math.ceil((thisYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          date: formatDate(thisYearBirthday),
          department: emp.department?.name,
          profileImage: emp.profileImage,
          daysUntil,
          isToday: daysUntil === 0,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return NextResponse.json({
      success: true,
      data: upcomingBirthdays,
    });
  } catch (error) {
    console.error('Get birthdays error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
