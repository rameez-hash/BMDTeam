const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const e = await p.employee.findMany({
    select: { firstName: true, lastName: true, employeeCode: true, employmentStatus: true, employmentType: true }
  });
  console.log(JSON.stringify(e, null, 2));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
