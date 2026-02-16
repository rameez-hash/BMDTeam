import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
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

// Default system roles with their permissions
const SYSTEM_ROLES = [
  {
    name: 'HR Manager',
    description: 'Full access to HR, employees, attendance, leave, payroll, and documents',
    color: '#8B5CF6',
    permissions: [
      // Full access
      { module: 'dashboard', action: 'view_admin', scope: 'ALL' },
      { module: 'employees', action: 'view', scope: 'ALL' },
      { module: 'employees', action: 'create', scope: 'ALL' },
      { module: 'employees', action: 'edit', scope: 'ALL' },
      { module: 'employees', action: 'delete', scope: 'ALL' },
      { module: 'departments', action: 'view', scope: 'ALL' },
      { module: 'departments', action: 'manage', scope: 'ALL' },
      { module: 'attendance', action: 'view', scope: 'ALL' },
      { module: 'attendance', action: 'manage', scope: 'ALL' },
      { module: 'attendance', action: 'approve', scope: 'ALL' },
      { module: 'attendance', action: 'export', scope: 'ALL' },
      { module: 'leave', action: 'view', scope: 'ALL' },
      { module: 'leave', action: 'manage', scope: 'ALL' },
      { module: 'leave', action: 'approve', scope: 'ALL' },
      { module: 'payroll', action: 'view', scope: 'ALL' },
      { module: 'payroll', action: 'manage', scope: 'ALL' },
      { module: 'payroll', action: 'export', scope: 'ALL' },
      { module: 'salary', action: 'view', scope: 'ALL' },
      { module: 'salary', action: 'manage', scope: 'ALL' },
      { module: 'documents', action: 'view', scope: 'ALL' },
      { module: 'documents', action: 'manage', scope: 'ALL' },
      { module: 'onboarding', action: 'view', scope: 'ALL' },
      { module: 'onboarding', action: 'manage', scope: 'ALL' },
      { module: 'overtime', action: 'view', scope: 'ALL' },
      { module: 'overtime', action: 'manage', scope: 'ALL' },
      { module: 'overtime', action: 'approve', scope: 'ALL' },
      { module: 'reports', action: 'view', scope: 'ALL' },
      { module: 'reports', action: 'export', scope: 'ALL' },
      { module: 'announcements', action: 'view', scope: 'ALL' },
      { module: 'announcements', action: 'manage', scope: 'ALL' },
      { module: 'holidays', action: 'view', scope: 'ALL' },
      { module: 'holidays', action: 'manage', scope: 'ALL' },
      { module: 'shifts', action: 'view', scope: 'ALL' },
      { module: 'shifts', action: 'manage', scope: 'ALL' },
      { module: 'settings', action: 'view', scope: 'ALL' },
      { module: 'settings', action: 'manage', scope: 'ALL' },
      { module: 'roles', action: 'view', scope: 'ALL' },
      { module: 'roles', action: 'manage', scope: 'ALL' },
    ],
  },
  {
    name: 'Department Manager',
    description: 'Can manage their own department employees, attendance, and leave',
    color: '#3B82F6',
    permissions: [
      { module: 'employees', action: 'view', scope: 'DEPARTMENT' },
      { module: 'attendance', action: 'view', scope: 'DEPARTMENT' },
      { module: 'attendance', action: 'manage', scope: 'DEPARTMENT' },
      { module: 'attendance', action: 'approve', scope: 'DEPARTMENT' },
      { module: 'leave', action: 'view', scope: 'DEPARTMENT' },
      { module: 'leave', action: 'approve', scope: 'DEPARTMENT' },
      { module: 'overtime', action: 'view', scope: 'DEPARTMENT' },
      { module: 'overtime', action: 'approve', scope: 'DEPARTMENT' },
      { module: 'announcements', action: 'view', scope: 'ALL' },
      { module: 'holidays', action: 'view', scope: 'ALL' },
      { module: 'reports', action: 'view', scope: 'DEPARTMENT' },
    ],
  },
  {
    name: 'Employee',
    description: 'Basic employee access - own data only',
    color: '#10B981',
    permissions: [
      { module: 'announcements', action: 'view', scope: 'ALL' },
      { module: 'holidays', action: 'view', scope: 'ALL' },
    ],
  },
];

async function main() {
  console.log('🔐 Seeding permissions...\n');

  // 1. Seed all permissions
  let created = 0;
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { module_action: { module: perm.module, action: perm.action } },
      update: { label: perm.label, description: perm.description },
      create: perm,
    });
    created++;
  }
  console.log(`✅ ${created} permissions seeded`);

  // 2. Seed system roles
  for (const roleData of SYSTEM_ROLES) {
    const existing = await prisma.appRole.findUnique({ where: { name: roleData.name } });
    
    if (existing) {
      console.log(`  ⏭️  Role "${roleData.name}" already exists, updating permissions...`);
      // Delete old permissions and re-create
      await prisma.rolePermission.deleteMany({ where: { roleId: existing.id } });
      
      for (const perm of roleData.permissions) {
        const dbPerm = await prisma.permission.findUnique({
          where: { module_action: { module: perm.module, action: perm.action } },
        });
        if (dbPerm) {
          await prisma.rolePermission.create({
            data: {
              roleId: existing.id,
              permissionId: dbPerm.id,
              scope: perm.scope as 'ALL' | 'DEPARTMENT' | 'SELF',
            },
          });
        }
      }
      console.log(`  ✅ Updated ${roleData.permissions.length} permissions for "${roleData.name}"`);
    } else {
      const role = await prisma.appRole.create({
        data: {
          name: roleData.name,
          description: roleData.description,
          color: roleData.color,
          isSystem: true,
        },
      });

      for (const perm of roleData.permissions) {
        const dbPerm = await prisma.permission.findUnique({
          where: { module_action: { module: perm.module, action: perm.action } },
        });
        if (dbPerm) {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: dbPerm.id,
              scope: perm.scope as 'ALL' | 'DEPARTMENT' | 'SELF',
            },
          });
        }
      }
      console.log(`  ✅ Created role "${roleData.name}" with ${roleData.permissions.length} permissions`);
    }
  }

  // 3. Assign HR Manager role to existing HR users
  const hrUsers = await prisma.user.findMany({
    where: { role: 'HR' },
    include: { employee: true },
  });

  const hrRole = await prisma.appRole.findUnique({ where: { name: 'HR Manager' } });
  if (hrRole && hrUsers.length > 0) {
    for (const user of hrUsers) {
      if (user.employee) {
        await prisma.employee.update({
          where: { id: user.employee.id },
          data: { appRoleId: hrRole.id },
        });
        console.log(`  ✅ Assigned HR Manager role to ${user.email}`);
      }
    }
  }

  // 4. Assign Department Manager role to existing MANAGER users
  const managerUsers = await prisma.user.findMany({
    where: { role: 'MANAGER' },
    include: { employee: true },
  });

  const mgrRole = await prisma.appRole.findUnique({ where: { name: 'Department Manager' } });
  if (mgrRole && managerUsers.length > 0) {
    for (const user of managerUsers) {
      if (user.employee) {
        await prisma.employee.update({
          where: { id: user.employee.id },
          data: { appRoleId: mgrRole.id },
        });
        console.log(`  ✅ Assigned Department Manager role to ${user.email}`);
      }
    }
  }

  // 5. Assign Employee role to EMPLOYEE users
  const empUsers = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    include: { employee: true },
  });

  const empRole = await prisma.appRole.findUnique({ where: { name: 'Employee' } });
  if (empRole && empUsers.length > 0) {
    for (const user of empUsers) {
      if (user.employee && !user.employee.appRoleId) {
        await prisma.employee.update({
          where: { id: user.employee.id },
          data: { appRoleId: empRole.id },
        });
      }
    }
    console.log(`  ✅ Assigned Employee role to ${empUsers.length} employees`);
  }

  console.log('\n🎉 Permission seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding permissions:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
