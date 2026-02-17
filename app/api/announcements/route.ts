export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { logActivity, ActivityActions, ActivityModules } from '@/lib/activity-logger';
import { getPaginationParams, parseDateUTC } from '@/lib/utils';
import { checkPermission } from '@/lib/permissions';

// GET /api/announcements - List announcements
export async function GET(request: NextRequest) {
  try {
    const { error } = await authenticate(request);
    if (error) return error;

    const searchParams = request.nextUrl.searchParams;
    const { page, limit, skip } = getPaginationParams(searchParams);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {
      isActive: true,
      publishDate: { lte: new Date() },
      OR: [
        { expiryDate: null },
        { expiryDate: { gte: new Date() } },
      ],
    };

    if (type) where.type = type;

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { publishDate: 'desc' }],
      }),
      prisma.announcement.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/announcements - Create announcement
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'announcements', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, type, priority, publishDate, expiryDate } = body;

    if (!title || !content || !publishDate) {
      return NextResponse.json(
        { error: 'Title, content, and publish date are required' },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        type: type || 'GENERAL',
        priority: priority || 'NORMAL',
        publishDate: parseDateUTC(publishDate),
        expiryDate: expiryDate ? parseDateUTC(expiryDate) : null,
        createdById: user!.userId,
      },
    });

    // Send notification to all active users
    try {
      const allUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      if (allUsers.length > 0) {
        await prisma.notification.createMany({
          data: allUsers.map(u => ({
            userId: u.id,
            title: `New Announcement: ${title}`,
            message: content.length > 200 ? content.substring(0, 200) + '...' : content,
            type: 'ANNOUNCEMENT' as const,
            module: 'announcements',
            resourceId: announcement.id,
            link: '/dashboard/announcements',
          })),
        });
      }
    } catch (notifError) {
      console.error('Failed to create announcement notifications:', notifError);
    }

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.ANNOUNCEMENT_CREATE,
      module: ActivityModules.ANNOUNCEMENT,
      resourceId: announcement.id,
      description: `Created announcement: ${title}`,
      request,
    });

    return NextResponse.json({
      success: true,
      data: announcement,
    }, { status: 201 });
  } catch (error) {
    console.error('Create announcement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/announcements - Update announcement
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'announcements', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { title, content, type, priority, publishDate, expiryDate, isActive } = body;

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(type && { type }),
        ...(priority && { priority }),
        ...(publishDate && { publishDate: new Date(publishDate) }),
        ...(expiryDate !== undefined && { expiryDate: expiryDate ? new Date(expiryDate) : null }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.ANNOUNCEMENT_UPDATE,
      module: ActivityModules.ANNOUNCEMENT,
      resourceId: announcement.id,
      description: `Updated announcement: ${announcement.title}`,
      request,
    });

    return NextResponse.json({ success: true, data: announcement });
  } catch (error) {
    console.error('Update announcement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/announcements - Delete announcement
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await authenticate(request);
    if (error) return error;

    const managePerm = await checkPermission(user!.userId, user!.role, 'announcements', 'manage');
    if (!managePerm.allowed) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID required' }, { status: 400 });
    }

    const announcement = await prisma.announcement.delete({ where: { id } });

    await logActivity({
      userId: user!.userId,
      action: ActivityActions.ANNOUNCEMENT_DELETE,
      module: ActivityModules.ANNOUNCEMENT,
      resourceId: id,
      description: `Deleted announcement: ${announcement.title}`,
      request,
    });

    return NextResponse.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
