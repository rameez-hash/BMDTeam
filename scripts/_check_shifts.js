const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  // Check no 8.3 records remain
  const bad = await p.attendance.findMany({ where: { shiftStandardWorkHours: 8.3 }, select: { id: true } });
  console.log('Records still at 8.3:', bad.length);

  // Show all distinct shift hours in attendance snapshots
  const all = await p.attendance.groupBy({
    by: ['shiftName', 'shiftStandardWorkHours'],
    where: { shiftStandardWorkHours: { not: null } },
    _count: true,
    orderBy: { shiftName: 'asc' },
  });
  console.log('\nAttendance snapshot shift hours:');
  console.table(all.map(r => ({ shift: r.shiftName, hours: r.shiftStandardWorkHours, count: r._count })));

  // Show actual shifts from Shift table
  const shifts = await p.shift.findMany({ select: { name: true, startTime: true, endTime: true, standardWorkHours: true, breakDuration: true } });
  console.log('\nShift table (actual):');
  console.table(shifts);

  await p['$disconnect']();
}
run().catch(console.error);
