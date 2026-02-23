const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const emp = await p.employee.findFirst({ where: { firstName: 'Faraz' } });
  const rec = await p.attendance.findFirst({
    where: { employeeId: emp.id, date: new Date('2026-02-20') },
    include: { breaks: true },
  });

  console.log('Record ID:', rec.id);
  console.log('Breaks:', rec.breaks.length);

  // Fix the break - cap at 60 min (shift break limit)
  for (const bk of rec.breaks) {
    const cappedEnd = new Date(bk.startTime.getTime() + 60 * 60000);
    await p.attendanceBreak.update({
      where: { id: bk.id },
      data: { endTime: cappedEnd, duration: 60 },
    });
    console.log('Break', bk.id, 'capped to 60m, endTime:', cappedEnd.toISOString());
  }

  // Fix attendance record
  await p.attendance.update({
    where: { id: rec.id },
    data: {
      checkoutMissing: true,
      workHours: 0,
      overtime: 0,
      notes: 'Checkout missed — employee did not check out on shift day. Record corrected by system.',
    },
  });
  console.log('Faraz Feb 20: checkoutMissing=true, workHours=0, break=60m');

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
