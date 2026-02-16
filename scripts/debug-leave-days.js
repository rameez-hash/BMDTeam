const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check Usman's shift
  const emp = await p.employee.findFirst({
    where: { firstName: 'Usman' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      shift: { select: { name: true, workDays: true, startTime: true, endTime: true } },
    },
  });
  console.log('Usman shift:', JSON.stringify(emp, null, 2));

  // Simulate calculateLeaveDays with his workDays
  const workDays = emp?.shift?.workDays || [1,2,3,4,5];
  console.log('\nworkDays type:', typeof workDays, Array.isArray(workDays));
  console.log('workDays value:', workDays);

  // Test: Feb 15 2026 is a Sunday (day 0)
  const testDate = new Date('2026-02-15');
  console.log('\nFeb 15 day of week:', testDate.getDay(), '(0=Sun)');
  console.log('Is workday?', (Array.isArray(workDays) ? workDays : [1,2,3,4,5]).includes(testDate.getDay()));

  // Check the leave request that had 0 days
  const leaveReqs = await p.leaveRequest.findMany({
    where: { employee: { firstName: 'Usman' } },
    include: { leaveType: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('\n=== Usman Leave Requests ===');
  for (const lr of leaveReqs) {
    console.log({
      startDate: lr.startDate.toISOString().slice(0,10),
      endDate: lr.endDate.toISOString().slice(0,10),
      totalDays: lr.totalDays,
      status: lr.status,
      type: lr.leaveType.name,
    });
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
