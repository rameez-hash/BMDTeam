export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { authenticate } from '@/lib/middleware';
import { checkPermission } from '@/lib/permissions';
import { parseDateUTC } from '@/lib/utils';

// GET /api/onboarding - Get onboarding records & templates
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'onboardings'; // 'onboardings' | 'templates'
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    if (view === 'templates') {
      const tplPerm = await checkPermission(user!.userId, user!.role, 'onboarding', 'manage');
      if (!tplPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const templates = await prisma.onboardingTemplate.findMany({
        include: { items: { orderBy: { sortOrder: 'asc' } }, _count: { select: { onboardings: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json({ templates });
    }

    // Onboardings list
    const where: any = {};

    const viewPerm = await checkPermission(user!.userId, user!.role, 'onboarding', 'view');
    if (!viewPerm.allowed || viewPerm.scope === 'SELF') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      where.employeeId = emp.id;
    } else if (viewPerm.scope === 'DEPARTMENT') {
      const emp = await prisma.employee.findUnique({ where: { userId: user!.userId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      const deptEmps = await prisma.employee.findMany({
        where: { departmentId: emp.departmentId },
        select: { id: true },
      });
      where.employeeId = { in: deptEmps.map(e => e.id) };
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { items: { some: { title: { contains: search } } } },
      ];
    }

    const onboardings = await prisma.onboarding.findMany({
      where,
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        template: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get employee info for each onboarding  
    const employeeIds = [...new Set(onboardings.map((o: any) => o.employeeId))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true, profileImage: true, department: { select: { name: true } } },
    });

    const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const enriched = onboardings.map(o => ({
      ...o,
      employee: employeeMap[o.employeeId] || null,
    }));

    // All active employees for dropdown
    const allEmployees = await prisma.employee.findMany({
      where: { employmentStatus: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: 'asc' },
    });

    // All active templates
    const templates = await prisma.onboardingTemplate.findMany({
      where: { isActive: true },
      select: { id: true, title: true, items: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ onboardings: enriched, employees: allEmployees, templates });
  } catch (error) {
    console.error('Error fetching onboarding:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding data' }, { status: 500 });
  }
}

// POST /api/onboarding - Create template or assign onboarding
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;
    const createPerm = await checkPermission(user!.userId, user!.role, 'onboarding', 'manage');
    if (!createPerm.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body; // 'create_template' | 'assign_onboarding'

    if (action === 'create_template') {
      const { title, description, items } = body;
      if (!title || !items?.length) {
        return NextResponse.json({ error: 'Title and at least one item required' }, { status: 400 });
      }

      const template = await prisma.onboardingTemplate.create({
        data: {
          title,
          description,
          items: {
            create: items.map((item: any, idx: number) => ({
              title: item.title,
              description: item.description || null,
              category: item.category || 'General',
              isRequired: item.isRequired !== false,
              sortOrder: idx,
            })),
          },
        },
        include: { items: true },
      });

      return NextResponse.json({ template }, { status: 201 });
    }

    if (action === 'assign_onboarding') {
      const { employeeId, templateId, dueDate, notes, customItems } = body;
      if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID required' }, { status: 400 });
      }

      // Check if employee already has an active onboarding
      const existing = await prisma.onboarding.findFirst({
        where: { employeeId, status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Employee already has an active onboarding' }, { status: 400 });
      }

      let itemsToCreate: any[] = [];

      if (templateId) {
        const template = await prisma.onboardingTemplate.findUnique({
          where: { id: templateId },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        });
        if (template) {
          itemsToCreate = template.items.map((item, idx) => ({
            title: item.title,
            description: item.description,
            category: item.category,
            isRequired: item.isRequired,
            sortOrder: idx,
          }));
        }
      }

      // Add custom items
      if (customItems?.length) {
        const startIdx = itemsToCreate.length;
        itemsToCreate.push(...customItems.map((item: any, idx: number) => ({
          title: item.title,
          description: item.description || null,
          category: item.category || 'General',
          isRequired: item.isRequired !== false,
          sortOrder: startIdx + idx,
        })));
      }

      if (!itemsToCreate.length) {
        return NextResponse.json({ error: 'At least one onboarding item required (select template or add custom items)' }, { status: 400 });
      }

      const onboarding = await prisma.onboarding.create({
        data: {
          employeeId,
          templateId: templateId || null,
          dueDate: dueDate ? parseDateUTC(dueDate) : null,
          assignedById: user!.userId,
          notes: notes || null,
          status: 'IN_PROGRESS',
          items: { create: itemsToCreate },
        },
        include: { items: true },
      });

      // Create notification for the employee
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true, firstName: true } });
      if (employee?.userId) {
        await prisma.notification.create({
          data: {
            userId: employee.userId,
            type: 'ONBOARDING',
            title: 'Onboarding Assigned',
            message: `Your onboarding checklist has been assigned with ${itemsToCreate.length} tasks.`,
            module: 'onboarding',
            resourceId: onboarding.id,
          },
        });
      }

      return NextResponse.json({ onboarding }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error creating onboarding:', error);
    return NextResponse.json({ error: 'Failed to create onboarding' }, { status: 500 });
  }
}

// PUT /api/onboarding - Update onboarding item / template
export async function PUT(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;

    const body = await request.json();
    const { action } = body;

    // Toggle item completion
    if (action === 'toggle_item') {
      const { itemId, completed, notes, documentUrl } = body;
      if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

      const item = await prisma.onboardingItem.update({
        where: { id: itemId },
        data: {
          isCompleted: completed,
          completedAt: completed ? new Date() : null,
          completedById: completed ? user!.userId : null,
          notes: notes !== undefined ? notes : undefined,
          documentUrl: documentUrl !== undefined ? documentUrl : undefined,
        },
      });

      // Check if all required items are completed
      const onboarding = await prisma.onboarding.findUnique({
        where: { id: item.onboardingId },
        include: { items: true },
      });

      if (onboarding) {
        const requiredItems = onboarding.items.filter(i => i.isRequired);
        const allRequiredDone = requiredItems.every(i => i.isCompleted);
        const allDone = onboarding.items.every(i => i.isCompleted);

        if (allDone || allRequiredDone) {
          await prisma.onboarding.update({
            where: { id: onboarding.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });
        } else if (onboarding.status === 'COMPLETED') {
          await prisma.onboarding.update({
            where: { id: onboarding.id },
            data: { status: 'IN_PROGRESS', completedAt: null },
          });
        }
      }

      return NextResponse.json({ item });
    }

    // Update template
    if (action === 'update_template') {
      const tplPerm = await checkPermission(user!.userId, user!.role, 'onboarding', 'manage');
      if (!tplPerm.allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { templateId, title, description, isActive } = body;
      if (!templateId) return NextResponse.json({ error: 'Template ID required' }, { status: 400 });

      const template = await prisma.onboardingTemplate.update({
        where: { id: templateId },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      return NextResponse.json({ template });
    }

    // Update onboarding status
    if (action === 'update_status') {
      const { onboardingId, status } = body;
      if (!onboardingId || !status) return NextResponse.json({ error: 'Onboarding ID and status required' }, { status: 400 });

      const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];
      if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

      const onboarding = await prisma.onboarding.update({
        where: { id: onboardingId },
        data: {
          status,
          ...(status === 'COMPLETED' ? { completedAt: new Date() } : { completedAt: null }),
        },
      });

      return NextResponse.json({ onboarding });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating onboarding:', error);
    return NextResponse.json({ error: 'Failed to update onboarding' }, { status: 500 });
  }
}

// DELETE /api/onboarding - Delete onboarding or template
export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticate(request); if (authError) return authError;
    const delPerm = await checkPermission(user!.userId, user!.role, 'onboarding', 'manage');
    if (!delPerm.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'onboarding'; // 'onboarding' | 'template'

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    if (type === 'template') {
      await prisma.onboardingTemplate.delete({ where: { id } });
    } else {
      await prisma.onboarding.delete({ where: { id } });
    }

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('Error deleting onboarding:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

