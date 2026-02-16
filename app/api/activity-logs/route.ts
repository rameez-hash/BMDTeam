import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { getPaginationParams } from '@/lib/utils';

// GET /api/activity-logs - List activity logs (Admin/HR only)
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const perm = await checkPermission(user!.userId, user!.role, 'settings', 'view');
    if (!perm.allowed) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    
    const module = searchParams.get('module');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {};
    
    if (module) where.module = module;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    // Non-admin users can only see limited logs (not admin-only actions)
    if (user!.role !== 'ADMIN') {
      where.module = {
        notIn: ['TAX_SLAB', 'LATE_RULE'],
      };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              email: true,
              employee: {
                select: { firstName: true, lastName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        action: log.action,
        module: log.module,
        resourceId: log.resourceId,
        description: log.description,
        user: log.user.employee 
          ? `${log.user.employee.firstName} ${log.user.employee.lastName}`
          : log.user.email,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
        oldData: log.oldData,
        newData: log.newData,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
