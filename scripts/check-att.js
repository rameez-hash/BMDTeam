const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const emp = await p.employee.findFirst({ where: { firstName: 'Usman' } });
  if (!emp) { console.log('Not found'); await p.$disconnect(); return; }
  console.log('Employee:', emp.id, emp.firstName, emp.lastName);

  const att = await p.attendance.findMany({
    where: {
      employeeId: emp.id,
      date: {
        gte: new Date('2026-02-14T00:00:00Z'),
        lte: new Date('2026-02-18T23:59:59Z'),
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log('Records found:', att.length);
  att.forEach(a => {
    console.log(
      'Date:', a.date.toISOString(),
      '| Status:', a.status,
      '| CheckIn:', a.checkIn ? a.checkIn.toISOString() : 'null',
      '| CheckOut:', a.checkOut ? a.checkOut.toISOString() : 'null',
      '| WorkHrs:', a.workHours
    );
  });

  await p.$disconnect();
})();
