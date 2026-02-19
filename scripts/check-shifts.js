const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasourceUrl: 'postgresql://neondb_owner:npg_T67xNBWUmewk@ep-flat-smoke-aik5vkfj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require'
});
(async () => {
  const shifts = await p.shift.findMany({
    select: { id: true, name: true, code: true, startTime: true, endTime: true, standardWorkHours: true, minWorkMinutes: true, breakDuration: true, graceTime: true }
  });
  console.log('=== SHIFTS ===');
  shifts.forEach(s => {
    const h = Math.floor(s.standardWorkHours);
    const m = Math.round((s.standardWorkHours - h) * 60);
    console.log(s.name + ' (' + s.code + '): ' + s.startTime + '-' + s.endTime + ', stdHrs=' + s.standardWorkHours + ' (' + h + 'h ' + m + 'm), minWork=' + s.minWorkMinutes + 'm, break=' + s.breakDuration + 'm, grace=' + s.graceTime + 'm');
  });

  // Check records with overtime
  const otRecords = await p.attendance.findMany({
    where: { overtime: { gt: 0 } },
    select: { id: true, date: true, workHours: true, overtime: true, shiftStandardWorkHours: true, shiftName: true, employee: { select: { firstName: true, lastName: true } } },
    orderBy: { date: 'desc' },
    take: 10
  });
  console.log('\n=== RECENT OT RECORDS ===');
  otRecords.forEach(r => {
    console.log(r.date.toISOString().split('T')[0] + ': ' + r.employee.firstName + ' ' + r.employee.lastName + ', shift=' + r.shiftName + ', stdHrs=' + r.shiftStandardWorkHours + ', worked=' + r.workHours + 'h, OT=' + r.overtime + 'h');
  });

  // Check Ali Raza
  const ali = await p.employee.findFirst({ where: { firstName: 'Ali', lastName: 'Raza' }, select: { id: true, shiftId: true, shift: { select: { name: true, standardWorkHours: true } } } });
  console.log('\nAli shift now:', ali);
  if (ali) {
    const recs = await p.attendance.findMany({
      where: { employeeId: ali.id },
      select: { id: true, date: true, checkIn: true, checkOut: true, workHours: true, overtime: true, shiftStandardWorkHours: true, shiftName: true },
      orderBy: { date: 'desc' },
      take: 5
    });
    console.log('=== ALI RAZA RECORDS ===');
    recs.forEach(r => console.log(r.date.toISOString().split('T')[0] + ': shift=' + r.shiftName + ' stdSnap=' + r.shiftStandardWorkHours + ' worked=' + r.workHours + 'h OT=' + r.overtime + 'h'));
  }

  // Count records where shiftStandardWorkHours=8.3 
  const count83 = await p.attendance.count({ where: { shiftStandardWorkHours: 8.3 } });
  console.log('\nRecords with stdHrs=8.3 snapshot:', count83);

  await p.$disconnect();
})();
