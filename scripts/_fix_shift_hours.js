const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  // Find all attendance records with shiftStandardWorkHours != current shift value
  const stale = await p.attendance.findMany({
    where: { shiftStandardWorkHours: 8.3 },
    select: { id: true, date: true, shiftName: true, shiftStandardWorkHours: true, employee: { select: { firstName: true, lastName: true } } },
  });
  console.log('Records with 8.3h shift snapshot:', stale.length);
  stale.forEach(r => {
    console.log(r.date.toISOString().slice(0, 10), r.employee.firstName, r.employee.lastName, r.shiftName, r.shiftStandardWorkHours);
  });

  // Update all to 8.5
  if (stale.length > 0) {
    const result = await p.attendance.updateMany({
      where: { shiftStandardWorkHours: 8.3 },
      data: { shiftStandardWorkHours: 8.5 },
    });
    console.log('Updated', result.count, 'records from 8.3h to 8.5h');
  }

  await p['$disconnect']();
}
run().catch(console.error);
