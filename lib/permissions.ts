import prisma from './prisma';
import { PermissionScope } from '@prisma/client';

// Track whether permissions have been synced this process lifecycle
let permissionsSynced = false;

// ==================== PERMISSION DEFINITIONS ====================

export interface PermissionDef {
  module: string;
  action: string;
  label: string;
  description?: string;
}

export const PERMISSION_MODULES = {
  dashboard: 'Dashboard',
  employees: 'Employees',
  departments: 'Departments',
  attendance: 'Attendance',
  leave: 'Leave',
  payroll: 'Payroll',
  salary: 'Salary',
  documents: 'Documents',
  onboarding: 'Onboarding',
  overtime: 'Overtime',
  reports: 'Reports',
  announcements: 'Announcements',
  holidays: 'Holidays',
  shifts: 'Shifts',
  settings: 'Settings',
  roles: 'Roles & Permissions',
} as const;

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Dashboard
  { module: 'dashboard', action: 'view_admin', label: 'View Admin Dashboard', description: 'Access admin dashboard with analytics' },

  // Employees
  { module: 'employees', action: 'view', label: 'View Employees', description: 'View employee list and profiles' },
  { module: 'employees', action: 'create', label: 'Create Employees', description: 'Add new employees' },
  { module: 'employees', action: 'edit', label: 'Edit Employees', description: 'Update employee details' },
  { module: 'employees', action: 'delete', label: 'Delete Employees', description: 'Remove employees' },

  // Departments
  { module: 'departments', action: 'view', label: 'View Departments', description: 'View department list' },
  { module: 'departments', action: 'manage', label: 'Manage Departments', description: 'Create, edit, delete departments' },

  // Attendance
  { module: 'attendance', action: 'view', label: 'View Attendance', description: 'View attendance records' },
  { module: 'attendance', action: 'manage', label: 'Manage Attendance', description: 'Edit and manage attendance' },
  { module: 'attendance', action: 'approve', label: 'Approve Corrections', description: 'Approve attendance corrections' },
  { module: 'attendance', action: 'export', label: 'Export Attendance', description: 'Download attendance reports' },

  // Leave
  { module: 'leave', action: 'view', label: 'View Leave', description: 'View leave requests' },
  { module: 'leave', action: 'manage', label: 'Manage Leave', description: 'Manage leave types and balances' },
  { module: 'leave', action: 'approve', label: 'Approve Leave', description: 'Approve or reject leave requests' },

  // Payroll
  { module: 'payroll', action: 'view', label: 'View Payroll', description: 'View payroll records' },
  { module: 'payroll', action: 'manage', label: 'Manage Payroll', description: 'Generate and edit payroll' },
  { module: 'payroll', action: 'export', label: 'Export Payroll', description: 'Download payroll data' },

  // Salary
  { module: 'salary', action: 'view', label: 'View Salary', description: 'View salary details' },
  { module: 'salary', action: 'manage', label: 'Manage Salary', description: 'Edit salary structures' },

  // Documents
  { module: 'documents', action: 'view', label: 'View Documents', description: 'View documents' },
  { module: 'documents', action: 'manage', label: 'Manage Documents', description: 'Upload, assign, delete documents' },

  // Onboarding
  { module: 'onboarding', action: 'view', label: 'View Onboarding', description: 'View onboarding tasks' },
  { module: 'onboarding', action: 'manage', label: 'Manage Onboarding', description: 'Create and manage onboarding' },

  // Overtime
  { module: 'overtime', action: 'view', label: 'View Overtime', description: 'View overtime records' },
  { module: 'overtime', action: 'manage', label: 'Manage Overtime', description: 'Record and manage overtime' },
  { module: 'overtime', action: 'approve', label: 'Approve Overtime', description: 'Approve overtime entries' },

  // Reports
  { module: 'reports', action: 'view', label: 'View Reports', description: 'View reports' },
  { module: 'reports', action: 'export', label: 'Export Reports', description: 'Export report data' },

  // Announcements
  { module: 'announcements', action: 'view', label: 'View Announcements', description: 'View announcements' },
  { module: 'announcements', action: 'manage', label: 'Manage Announcements', description: 'Create, edit, delete announcements' },

  // Holidays
  { module: 'holidays', action: 'view', label: 'View Holidays', description: 'View holiday calendar' },
  { module: 'holidays', action: 'manage', label: 'Manage Holidays', description: 'Create, edit, delete holidays' },

  // Shifts
  { module: 'shifts', action: 'view', label: 'View Shifts', description: 'View shift schedules' },
  { module: 'shifts', action: 'manage', label: 'Manage Shifts', description: 'Create, edit, delete shifts' },

  // Settings
  { module: 'settings', action: 'view', label: 'View Settings', description: 'View system settings' },
  { module: 'settings', action: 'manage', label: 'Manage Settings', description: 'Edit system settings' },

  // Roles & Permissions
  { module: 'roles', action: 'view', label: 'View Roles', description: 'View roles list' },
  { module: 'roles', action: 'manage', label: 'Manage Roles', description: 'Create, edit, delete roles and permissions' },
];

// ==================== PERMISSION CHECK ====================

export interface PermissionCheckResult {
  allowed: boolean;
  scope: PermissionScope | null;
}

export interface UserPermission {
  module: string;
  action: string;
  scope: PermissionScope;
}

/**
 * Check if a user has a specific permission.
 * ADMIN role always returns { allowed: true, scope: 'ALL' }
 * Otherwise checks dynamic permissions from AppRole + individual overrides.
 */
export async function checkPermission(
  userId: string,
  userRole: string,
  module: string,
  action: string
): Promise<PermissionCheckResult> {
  // ADMIN bypasses all permission checks
  if (userRole === 'ADMIN') {
    return { allowed: true, scope: 'ALL' as PermissionScope };
  }

  // Get employee with role permissions and individual permissions
  const employee = await prisma.employee.findFirst({
    where: { userId },
    include: {
      appRole: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      employeePermissions: {
        include: { permission: true },
      },
    },
  });

  if (!employee) return { allowed: false, scope: null };

  // Check individual employee permissions first (overrides role)
  const individualPerm = employee.employeePermissions.find(
    ep => ep.permission.module === module && ep.permission.action === action
  );
  if (individualPerm) {
    return { allowed: individualPerm.granted, scope: individualPerm.scope };
  }

  // Check role permissions
  if (employee.appRole) {
    const rolePerm = employee.appRole.permissions.find(
      rp => rp.permission.module === module && rp.permission.action === action
    );
    if (rolePerm) {
      return { allowed: true, scope: rolePerm.scope };
    }
  }

  return { allowed: false, scope: null };
}

/**
 * Get all permissions for a user (combined from role + individual).
 * Used to send to frontend for UI-level permission checks.
 */
export async function getUserPermissions(userId: string, userRole: string): Promise<UserPermission[]> {
  // ADMIN gets all permissions with ALL scope
  if (userRole === 'ADMIN') {
    return ALL_PERMISSIONS.map(p => ({
      module: p.module,
      action: p.action,
      scope: 'ALL' as PermissionScope,
    }));
  }

  const employee = await prisma.employee.findFirst({
    where: { userId },
    include: {
      appRole: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      employeePermissions: {
        include: { permission: true },
      },
    },
  });

  if (!employee) return [];

  const permMap = new Map<string, UserPermission>();

  // Add role permissions first
  if (employee.appRole) {
    for (const rp of employee.appRole.permissions) {
      const key = `${rp.permission.module}:${rp.permission.action}`;
      permMap.set(key, {
        module: rp.permission.module,
        action: rp.permission.action,
        scope: rp.scope,
      });
    }
  }

  // Individual permissions override role permissions
  for (const ep of employee.employeePermissions) {
    const key = `${ep.permission.module}:${ep.permission.action}`;
    if (ep.granted) {
      permMap.set(key, {
        module: ep.permission.module,
        action: ep.permission.action,
        scope: ep.scope,
      });
    } else {
      // If explicitly revoked, remove it
      permMap.delete(key);
    }
  }

  return Array.from(permMap.values());
}

/**
 * Apply department scope filter to a Prisma where clause.
 * Returns the where clause with department filtering applied.
 */
export function applyDepartmentScope(
  scope: PermissionScope,
  employeeDepartmentId: string | null | undefined,
  whereClause: Record<string, unknown> = {}
): Record<string, unknown> {
  if (scope === 'ALL') return whereClause;
  
  if (scope === 'DEPARTMENT' && employeeDepartmentId) {
    return { ...whereClause, departmentId: employeeDepartmentId };
  }
  
  // SELF scope - handled by the calling code (usually filter by userId/employeeId)
  return whereClause;
}

/**
 * Sync ALL_PERMISSIONS definitions to the Permission table in the database.
 * Uses upsert to create missing records and update labels/descriptions.
 * Cached per process lifecycle to avoid running on every request.
 */
export async function syncPermissionsToDb(): Promise<void> {
  if (permissionsSynced) return;
  
  try {
    for (const perm of ALL_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { module_action: { module: perm.module, action: perm.action } },
        update: { label: perm.label, description: perm.description || null },
        create: {
          module: perm.module,
          action: perm.action,
          label: perm.label,
          description: perm.description || null,
        },
      });
    }
    permissionsSynced = true;
  } catch (error) {
    console.error('Failed to sync permissions to DB:', error);
  }
}
