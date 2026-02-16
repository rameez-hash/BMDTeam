const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find Employee role
  const empRole = await p.appRole.findUnique({ where: { name: 'Employee' } });
  if (!empRole) {
    console.log('Employee role not found');
    return;
  }

  console.log('Employee role ID:', empRole.id);

  // Get current permissions
  const current = await p.rolePermission.findMany({
    where: { roleId: empRole.id },
    include: { permission: { select: { module: true, action: true } } },
  });
  console.log('\nCurrent permissions:');
  for (const rp of current) {
    console.log(`  ${rp.permission.module}.${rp.permission.action} (${rp.scope})`);
  }

  // Remove permissions that employees shouldn't have
  // Employees don't need management views - they have "My Attendance", "My Leave", "My Payslips"
  const toRemove = ['attendance.view', 'leave.view', 'onboarding.view'];
  
  for (const pStr of toRemove) {
    const [mod, act] = pStr.split('.');
    const perm = await p.permission.findUnique({
      where: { module_action: { module: mod, action: act } },
    });
    if (perm) {
      const deleted = await p.rolePermission.deleteMany({
        where: { roleId: empRole.id, permissionId: perm.id },
      });
      if (deleted.count > 0) {
        console.log(`  ❌ Removed ${pStr}`);
      }
    }
  }

  // Verify final state
  const final = await p.rolePermission.findMany({
    where: { roleId: empRole.id },
    include: { permission: { select: { module: true, action: true } } },
  });
  console.log('\nFinal Employee permissions:');
  for (const rp of final) {
    console.log(`  ✅ ${rp.permission.module}.${rp.permission.action} (${rp.scope})`);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
