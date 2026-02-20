const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // Check all shifts
  const shifts = await p.shift.findMany({ select: { id: true, name: true, code: true, startTime: true, endTime: true, standardWorkHours: true, graceTime: true } });
  console.log('All Shifts:');
  shifts.forEach(s => {
    const h = Math.floor(s.standardWorkHours);
    const m = Math.round((s.standardWorkHours - h) * 60);
    console.log(`  ${s.name} (${s.code}): ${s.startTime}-${s.endTime}, std=${s.standardWorkHours}h (${h}h ${m}m), grace=${s.graceTime}min`);
  });

  // Check all attendance records with Ramzan Morning 2 snapshot
  const rm2Records = await p.attendance.findMany({
    where: { shiftName: 'Ramzan Morning 2' },
    select: { id: true, date: true, shiftStandardWorkHours: true, workHours: true, employeeId: true }
  });
  console.log('\nRamzan Morning 2 attendance records with snapshots:');
  rm2Records.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)} emp=${r.employeeId.slice(0,8)} snapshot=${r.shiftStandardWorkHours}h workHours=${r.workHours}h`));

  // Check all records where shiftStandardWorkHours != current shift value
  const staleRecords = await p.attendance.findMany({
    where: { 
      shiftStandardWorkHours: { not: null },
      NOT: { shiftName: null }
    },
    select: { id: true, date: true, shiftName: true, shiftStandardWorkHours: true, employeeId: true, workHours: true }
  });
  
  // Group by shiftName and check against current shift
  const shiftMap = {};
  shifts.forEach(s => shiftMap[s.name] = s.standardWorkHours);
  
  const stale = staleRecords.filter(r => shiftMap[r.shiftName] && r.shiftStandardWorkHours !== shiftMap[r.shiftName]);
  if (stale.length > 0) {
    console.log('\nStale snapshot records (snapshot != current shift value):');
    stale.forEach(r => console.log(`  ${r.date.toISOString().slice(0,10)} shift=${r.shiftName} snapshot=${r.shiftStandardWorkHours} current=${shiftMap[r.shiftName]} emp=${r.employeeId.slice(0,8)}`));
  } else {
    console.log('\nNo stale snapshot records found');
  }

  await p.$disconnect();
})();
