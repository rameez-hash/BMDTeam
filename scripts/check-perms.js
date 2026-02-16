const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const employees = await p.employee.findMany({
    where: { user: { role: 'EMPLOYEE' } },
    select: {
      firstName: true,
      lastName: true,
      appRole: {
        select: {
          name: true,
          permissions: {
            select: {
              permission: { select: { module: true, action: true } },
              scope: true,
            },
          },
        },
      },
    },
  });

  for (const e of employees) {
    console.log(`${e.firstName} ${e.lastName} => Role: ${e.appRole?.name || 'NONE'}`);
    if (e.appRole?.permissions) {
      for (const rp of e.appRole.permissions) {
        console.log(`  ${rp.permission.module}.${rp.permission.action} (${rp.scope})`);
      }
    }
  }
  
  // Also check individual employee permissions
  const indPerms = await p.employeePermission.findMany({
    include: {
      employee: { select: { firstName: true, lastName: true } },
      permission: { select: { module: true, action: true } },
    },
  });
  
  if (indPerms.length > 0) {
    console.log('\n--- Individual Employee Permissions ---');
    for (const ip of indPerms) {
      console.log(`${ip.employee.firstName} ${ip.employee.lastName}: ${ip.permission.module}.${ip.permission.action} granted=${ip.granted} scope=${ip.scope}`);
    }
  }
  
  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
