const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // Get all shifts
  const shifts = await p.shift.findMany({ select: { name: true, standardWorkHours: true } });
  const shiftMap = {};
  shifts.forEach(s => shiftMap[s.name] = s.standardWorkHours);
  console.log('Current shift values:', JSON.stringify(shiftMap, null, 2));

  // Fix all stale snapshots
  let totalFixed = 0;
  for (const [shiftName, stdHours] of Object.entries(shiftMap)) {
    const result = await p.attendance.updateMany({
      where: {
        shiftName: shiftName,
        shiftStandardWorkHours: { not: stdHours }
      },
      data: {
        shiftStandardWorkHours: stdHours
      }
    });
    if (result.count > 0) {
      console.log(`Fixed ${result.count} records for "${shiftName}": set to ${stdHours}h`);
      totalFixed += result.count;
    }
  }
  
  console.log(`\nTotal fixed: ${totalFixed} records`);
  await p.$disconnect();
})();
