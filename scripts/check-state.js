const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Recent attendance for Usman
  const records = await p.attendance.findMany({
    where: { employee: { firstName: 'Usman' } },
    orderBy: { date: 'desc' },
    take: 10,
    include: { employee: { select: { firstName: true, shift: true } } }
  });
  
  console.log('=== Usman Attendance Records ===');
  for (const r of records) {
    console.log({
      date: r.date.toISOString().slice(0, 10),
      checkIn: r.checkIn?.toISOString(),
      checkOut: r.checkOut?.toISOString(),
      isLate: r.isLate,
      lateMinutes: r.lateMinutes,
      workHours: r.workHours,
      shiftName: r.shiftName,
      shiftStart: r.shiftStartTime,
      shiftEnd: r.shiftEndTime,
    });
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
