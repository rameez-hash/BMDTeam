const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check Feb 15 attendance for Usman (Sunday — should not have ON_LEAVE)
  const emp = await p.employee.findFirst({ where: { firstName: 'Usman' }, select: { id: true } });
  if (!emp) { console.log('Usman not found'); return; }
  
  const att = await p.attendance.findFirst({
    where: { employeeId: emp.id, date: new Date('2026-02-15') },
  });
  
  if (att) {
    console.log('Feb 15 attendance:', { status: att.status, date: att.date });
    // If it was ON_LEAVE for a Sunday, it's bad data - delete it
    if (att.status === 'ON_LEAVE') {
      await p.attendance.delete({ where: { id: att.id } });
      console.log('Deleted ON_LEAVE attendance for Sunday Feb 15');
    }
  } else {
    console.log('No attendance record for Feb 15 (Sunday) — correct');
  }

  // Also fix the notification that shows "0 day(s)"
  const badNotif = await p.notification.findFirst({
    where: { message: { contains: '0 day(s)' } },
  });
  if (badNotif) {
    await p.notification.delete({ where: { id: badNotif.id } });
    console.log('Deleted "0 day(s)" notification');
  }

  console.log('\nDone!');
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
