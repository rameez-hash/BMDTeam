const { PrismaClient } = require('../node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // Find all attendance records that have breaks
  const records = await p.attendance.findMany({
    where: {
      checkIn: { not: null },
      checkOut: { not: null },
    },
    include: { breaks: true, employee: { select: { firstName: true, lastName: true } } }
  });

  let fixed = 0;
  for (const r of records) {
    if (!r.breaks || r.breaks.length === 0) continue;
    
    // Calculate total break minutes
    let totalBreakMins = 0;
    for (const b of r.breaks) {
      if (b.endTime) {
        totalBreakMins += Math.round((b.endTime.getTime() - b.startTime.getTime()) / 60000);
      }
    }
    
    if (totalBreakMins === 0) continue;
    
    // Correct work hours = checkOut - checkIn (no break deduction)
    const totalMins = Math.round((r.checkOut.getTime() - r.checkIn.getTime()) / 60000);
    const correctWorkHours = Math.round((totalMins / 60) * 100) / 100;
    
    if (Math.abs(correctWorkHours - r.workHours) > 0.01) {
      console.log(`${r.employee.firstName} ${r.employee.lastName} - ${r.date.toISOString().slice(0,10)}: ${r.workHours}h -> ${correctWorkHours}h (had ${totalBreakMins}m break deducted)`);
      
      // Recalculate overtime
      const stdHours = r.shiftStandardWorkHours || 9;
      const overtime = correctWorkHours >= stdHours ? Math.round((correctWorkHours - stdHours) * 100) / 100 : 0;
      
      await p.attendance.update({
        where: { id: r.id },
        data: {
          workHours: correctWorkHours,
          overtime: overtime,
        }
      });
      fixed++;
    }
  }
  
  console.log(`\nFixed ${fixed} records`);
  await p.$disconnect();
})();
