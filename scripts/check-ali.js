const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  const ali = await p.employee.findFirst({
    where: { firstName: 'Ali', lastName: 'Raza' },
    select: { id: true, firstName: true, lastName: true, shiftId: true }
  });
  console.log('Ali:', JSON.stringify(ali));

  const r19 = await p.attendance.findMany({
    where: {
      employeeId: ali.id,
      date: { gte: new Date('2026-02-19T00:00:00Z'), lte: new Date('2026-02-19T23:59:59Z') }
    }
  });
  console.log('\nFeb 19 records:', JSON.stringify(r19, null, 2));

  const r20 = await p.attendance.findMany({
    where: {
      employeeId: ali.id,
      date: { gte: new Date('2026-02-20T00:00:00Z'), lte: new Date('2026-02-20T23:59:59Z') }
    }
  });
  console.log('\nFeb 20 records:', JSON.stringify(r20, null, 2));

  await p.$disconnect();
})();
