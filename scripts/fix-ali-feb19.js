const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // Ali Feb 19 record
  const recordId = '06f529b8-1391-4d4d-930e-edae611a77c1';
  
  // checkIn: 2026-02-19T04:45:00.000Z = 09:45 AM PKT
  // shift start: 08:00, grace: 20 min => grace ends at 08:20
  // Late from grace end: 9:45 - 8:20 = 85 minutes
  
  const updated = await p.attendance.update({
    where: { id: recordId },
    data: {
      isLate: true,
      lateMinutes: 85,
    }
  });
  
  console.log('Updated Ali Feb 19 record:');
  console.log('  isLate:', updated.isLate);
  console.log('  lateMinutes:', updated.lateMinutes);
  console.log('  checkIn:', updated.checkIn);
  console.log('  checkOut:', updated.checkOut);
  console.log('  workHours:', updated.workHours);
  
  await p.$disconnect();
})();
