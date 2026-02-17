export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { authenticate } from '../../../../lib/middleware';
import { notify, notifyMany } from '../../../../lib/notifications';

// GET — Check for expired probation/notice periods and send notifications
export async function GET(request: NextRequest) {
  try {
    const { user: auth, error } = await authenticate(request);
    if (error) return error;
    if (auth!.role !== 'ADMIN' && auth!.role !== 'HR') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = { probationExpired: 0, noticeExpired: 0, probationExpiring: 0, noticeExpiring: 0 };

    // --- Probation Period Check ---
    // Find employees with PROBATION status whose probation has ended
    const probationExpired = await prisma.employee.findMany({
      where: {
        employmentStatus: 'PROBATION',
        probationEndDate: { lte: today },
      },
      include: { user: { select: { id: true } } },
    });

    for (const emp of probationExpired) {
      // Check if we already sent a notification for this
      const existing = await prisma.notification.findFirst({
        where: {
          userId: emp.userId,
          title: 'Probation Period Completed',
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7) },
        },
      });
      if (existing) continue;

      // Notify the employee
      await notify({
        userId: emp.userId,
        title: 'Probation Period Completed',
        message: `Your probation period has ended. Please contact HR for confirmation of your employment status.`,
        type: 'INFO',
        module: 'employees',
        link: '/dashboard/profile',
      });

      // Notify all admin/HR users
      const adminHR = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'HR'] }, isActive: true },
        select: { id: true },
      });
      await notifyMany(
        adminHR.map(u => u.id),
        {
          title: 'Probation Period Completed',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})'s probation period has ended. Please review and update their employment status.`,
          type: 'WARNING',
          module: 'employees',
          link: `/dashboard/employees/${emp.id}`,
        }
      );
      results.probationExpired++;
    }

    // Probation expiring soon (within 7 days)
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    
    const probationExpiring = await prisma.employee.findMany({
      where: {
        employmentStatus: 'PROBATION',
        probationEndDate: { gt: today, lte: sevenDaysLater },
      },
      include: { user: { select: { id: true } } },
    });

    for (const emp of probationExpiring) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: emp.userId,
          title: 'Probation Period Ending Soon',
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3) },
        },
      });
      if (existing) continue;

      const daysLeft = Math.ceil((emp.probationEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      await notify({
        userId: emp.userId,
        title: 'Probation Period Ending Soon',
        message: `Your probation period will end in ${daysLeft} day(s). Please ensure all requirements are met.`,
        type: 'INFO',
        module: 'employees',
        link: '/dashboard/profile',
      });

      const adminHR = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'HR'] }, isActive: true },
        select: { id: true },
      });
      await notifyMany(
        adminHR.map(u => u.id),
        {
          title: 'Probation Period Ending Soon',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})'s probation ends in ${daysLeft} day(s).`,
          type: 'INFO',
          module: 'employees',
          link: `/dashboard/employees/${emp.id}`,
        }
      );
      results.probationExpiring++;
    }

    // --- Notice Period Check ---
    // Find employees with ON_NOTICE status whose notice period has ended
    const noticeExpired = await prisma.employee.findMany({
      where: {
        employmentStatus: 'ON_NOTICE',
        noticePeriodEndDate: { lte: today },
      },
      include: { user: { select: { id: true } } },
    });

    for (const emp of noticeExpired) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: emp.userId,
          title: 'Notice Period Completed',
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7) },
        },
      });
      if (existing) continue;

      await notify({
        userId: emp.userId,
        title: 'Notice Period Completed',
        message: `Your notice period has ended. Please coordinate with HR for final clearance.`,
        type: 'INFO',
        module: 'employees',
        link: '/dashboard/profile',
      });

      const adminHR = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'HR'] }, isActive: true },
        select: { id: true },
      });
      await notifyMany(
        adminHR.map(u => u.id),
        {
          title: 'Notice Period Completed',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})'s notice period has ended. Please process their relieving.`,
          type: 'WARNING',
          module: 'employees',
          link: `/dashboard/employees/${emp.id}`,
        }
      );
      results.noticeExpired++;
    }

    // Notice period expiring soon (within 7 days)
    const noticeExpiring = await prisma.employee.findMany({
      where: {
        employmentStatus: 'ON_NOTICE',
        noticePeriodEndDate: { gt: today, lte: sevenDaysLater },
      },
      include: { user: { select: { id: true } } },
    });

    for (const emp of noticeExpiring) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: emp.userId,
          title: 'Notice Period Ending Soon',
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3) },
        },
      });
      if (existing) continue;

      const daysLeft = Math.ceil((emp.noticePeriodEndDate!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      await notify({
        userId: emp.userId,
        title: 'Notice Period Ending Soon',
        message: `Your notice period will end in ${daysLeft} day(s). Please complete all handover tasks.`,
        type: 'INFO',
        module: 'employees',
        link: '/dashboard/profile',
      });

      const adminHR = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'HR'] }, isActive: true },
        select: { id: true },
      });
      await notifyMany(
        adminHR.map(u => u.id),
        {
          title: 'Notice Period Ending Soon',
          message: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})'s notice period ends in ${daysLeft} day(s).`,
          type: 'INFO',
          module: 'employees',
          link: `/dashboard/employees/${emp.id}`,
        }
      );
      results.noticeExpiring++;
    }

    return NextResponse.json({
      message: 'Period check completed',
      data: results,
    });
  } catch (error) {
    console.error('Error checking periods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
