const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const emps = await p.employee.findMany({
    include: { shift: { select: { name: true, workDays: true } } }
  });
  emps.forEach(e => console.log(e.firstName, e.lastName, 'shift:', e.shift?.name, 'workDays:', e.shift?.workDays));
  await p.$disconnect();
})();
