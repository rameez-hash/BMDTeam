const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. All employees with their shifts and userIds
  const emps = await p.employee.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      userId: true,
      joiningDate: true,
      shift: { select: { name: true, workDays: true } },
    },
  });
  console.log('=== ALL EMPLOYEES ===');
  emps.forEach(e => console.log(JSON.stringify(e)));

  // 2. Check Usman's user role and permissions
  const usmanEmp = emps.find(e => e.firstName === 'Usman');
  if (usmanEmp) {
    const user = await p.user.findUnique({
      where: { id: usmanEmp.userId },
      select: { id: true, email: true, role: true, employeeId: true },
    });
    console.log('\n=== USMAN USER ===');
    console.log(JSON.stringify(user));

    // Check permissions
    const emp = await p.employee.findFirst({
      where: { userId: usmanEmp.userId },
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
    console.log('\n=== USMAN ROLE ===');
    console.log('AppRole:', emp.appRole?.name || 'NONE');
    if (emp.appRole) {
      const attPerm = emp.appRole.permissions.filter(
        rp => rp.permission.module === 'attendance'
      );
      console.log('Attendance role perms:', attPerm.map(rp => ({
        action: rp.permission.action,
        scope: rp.scope,
      })));
    }
    const indivAtt = emp.employeePermissions.filter(
      ep => ep.permission.module === 'attendance'
    );
    console.log('Attendance individual perms:', indivAtt.map(ip => ({
      action: ip.permission.action,
      scope: ip.scope,
      granted: ip.granted,
    })));
  }

  // 3. Count attendance+generated records for Feb 2026 with employee=Usman scope test 
  const feb1 = new Date('2026-02-01');
  const feb28 = new Date('2026-02-28');
  const attRecords = await p.attendance.findMany({
    where: {
      date: { gte: feb1, lte: feb28 },
    },
    select: {
      id: true,
      date: true,
      status: true,
      employeeId: true,
      employee: { select: { firstName: true } },
    },
    orderBy: { date: 'desc' },
  });
  console.log('\n=== ALL FEB ATTENDANCE RECORDS ===');
  console.log('Total:', attRecords.length);
  const byEmp = {};
  attRecords.forEach(r => {
    const name = r.employee.firstName;
    if (!byEmp[name]) byEmp[name] = 0;
    byEmp[name]++;
  });
  console.log('By employee:', byEmp);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
