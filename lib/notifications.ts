import prisma from '@/lib/prisma';

type NotificationType =
  | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  | 'LEAVE_REQUEST' | 'LEAVE_APPROVED' | 'LEAVE_REJECTED'
  | 'PAYROLL_GENERATED' | 'PAYROLL_PAID'
  | 'ATTENDANCE_CORRECTION' | 'ANNOUNCEMENT'
  | 'ONBOARDING' | 'OVERTIME' | 'DOCUMENT'
  | 'PROMOTION';

interface NotifyParams {
  userId: string;           // Target user to notify
  title: string;
  message: string;
  type: NotificationType;
  module: string;           // leave, payroll, attendance, etc.
  resourceId?: string;
  link?: string;            // Navigation link e.g. /dashboard/leave
}

/**
 * Send a notification to a single user
 */
export async function notify(params: NotifyParams) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type,
        module: params.module,
        resourceId: params.resourceId || null,
        link: params.link || getNotificationLink(params.type, params.module),
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Send a notification to multiple users
 */
export async function notifyMany(userIds: string[], params: Omit<NotifyParams, 'userId'>) {
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        title: params.title,
        message: params.message,
        type: params.type,
        module: params.module,
        resourceId: params.resourceId || null,
        link: params.link || getNotificationLink(params.type, params.module),
      })),
    });
  } catch (error) {
    console.error('Failed to create notifications:', error);
  }
}

/**
 * Get all user IDs that have a specific permission (module.action)
 * Optionally filter by departmentId for department-scoped notifications
 */
export async function getUsersWithPermission(
  module: string,
  action: string,
  departmentId?: string | null,
  excludeUserId?: string
): Promise<string[]> {
  // 1. ADMIN users always get notified (hardcoded bypass)
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  const userIds = new Set(adminUsers.map(u => u.id));

  // 2. Find the permission
  const permission = await prisma.permission.findUnique({
    where: { module_action: { module, action } },
    select: { id: true },
  });
  if (!permission) return Array.from(userIds);

  // 3. Find users via role permissions
  const rolePerms = await prisma.rolePermission.findMany({
    where: { permissionId: permission.id },
    include: {
      role: {
        include: {
          employees: {
            where: { employmentStatus: 'ACTIVE' },
            select: { userId: true, departmentId: true },
          },
        },
      },
    },
  });

  for (const rp of rolePerms) {
    for (const emp of rp.role.employees) {
      // If department-scoped, only include users from same department
      if (rp.scope === 'DEPARTMENT' && departmentId && emp.departmentId !== departmentId) continue;
      if (rp.scope === 'SELF') continue; // SELF scope can't approve others
      userIds.add(emp.userId);
    }
  }

  // 4. Find users via direct employee permissions
  const empPerms = await prisma.employeePermission.findMany({
    where: { permissionId: permission.id, granted: true },
    include: {
      employee: {
        select: { userId: true, departmentId: true, employmentStatus: true },
      },
    },
  });

  for (const ep of empPerms) {
    if (ep.employee.employmentStatus !== 'ACTIVE') continue;
    if (ep.scope === 'SELF') continue;
    if (ep.scope === 'DEPARTMENT' && departmentId && ep.employee.departmentId !== departmentId) continue;
    userIds.add(ep.employee.userId);
  }

  // Exclude the triggering user
  if (excludeUserId) userIds.delete(excludeUserId);

  return Array.from(userIds);
}

/**
 * Get the link path for a notification type/module
 */
export function getNotificationLink(type: NotificationType, module?: string): string {
  switch (type) {
    case 'LEAVE_REQUEST':
      return '/dashboard/leave';
    case 'LEAVE_APPROVED':
    case 'LEAVE_REJECTED':
      return '/dashboard/employee-leave';
    case 'ATTENDANCE_CORRECTION':
      return '/dashboard/attendance';
    case 'PAYROLL_GENERATED':
    case 'PAYROLL_PAID':
      return '/dashboard/my-payslips';
    case 'OVERTIME':
      return '/dashboard/overtime';
    case 'ONBOARDING':
      return '/dashboard/onboarding';
    case 'ANNOUNCEMENT':
      return '/dashboard/announcements';
    case 'DOCUMENT':
      return '/dashboard/documents';
    case 'PROMOTION':
      return '/dashboard/notifications';
    default:
      return '/dashboard/notifications';
  }
}
