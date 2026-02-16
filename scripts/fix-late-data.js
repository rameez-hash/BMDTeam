// Fix stale late/early data on all attendance records
// This recalculates isLate + lateMinutes using the date-aware calculateLateArrival

const { PrismaClient } = require('@prisma/client');

// Inline the calculation logic (can't import TS from JS)
function isNightShift(startTime, endTime) {
  const [sH] = startTime.split(':').map(Number);
  const [eH] = endTime.split(':').map(Number);
  return sH > eH;
}

function differenceInMinutes(later, earlier) {
  return Math.round((later.getTime() - earlier.getTime()) / 60000);
}

function calculateLateArrival(checkInTime, shiftStartTime, shiftEndTime, graceMinutes, attendanceDate) {
  const [startHours, startMinutes] = shiftStartTime.split(':').map(Number);
  
  let shiftStart;
  if (attendanceDate) {
    shiftStart = new Date(attendanceDate + 'T00:00:00');
    shiftStart.setHours(startHours, startMinutes, 0, 0);
  } else {
    shiftStart = new Date(checkInTime);
    shiftStart.setHours(startHours, startMinutes, 0, 0);
    
    if (isNightShift(shiftStartTime, shiftEndTime)) {
      const [endHours, endMins] = shiftEndTime.split(':').map(Number);
      const checkInTotalMins = checkInTime.getHours() * 60 + checkInTime.getMinutes();
      const shiftEndTotalMins = endHours * 60 + endMins;
      if (checkInTotalMins < shiftEndTotalMins) {
        shiftStart.setDate(shiftStart.getDate() - 1);
      }
    }
  }
  
  const gracePeriodEnd = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);
  
  if (checkInTime < shiftStart) {
    const earlyMinutes = differenceInMinutes(shiftStart, checkInTime);
    return { isLate: false, lateMinutes: 0, isEarly: true, earlyMinutes };
  }
  
  if (checkInTime <= gracePeriodEnd) {
    return { isLate: false, lateMinutes: 0, isEarly: false, earlyMinutes: 0 };
  }
  
  const lateMinutes = differenceInMinutes(checkInTime, gracePeriodEnd);
  return { isLate: true, lateMinutes, isEarly: false, earlyMinutes: 0 };
}

const p = new PrismaClient();

(async () => {
  // Get all attendance records that have check-in and shift snapshot
  const records = await p.attendance.findMany({
    where: {
      checkIn: { not: null },
      shiftStartTime: { not: null },
      shiftEndTime: { not: null },
    },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });

  console.log(`Found ${records.length} records to recalculate`);
  let fixed = 0;

  for (const r of records) {
    const dateStr = r.date.toISOString().slice(0, 10);
    const graceTime = r.shiftGraceTime || 15;
    
    const result = calculateLateArrival(r.checkIn, r.shiftStartTime, r.shiftEndTime, graceTime, dateStr);
    
    // Check if values differ
    if (r.isLate !== result.isLate || r.lateMinutes !== result.lateMinutes) {
      console.log(`FIX: ${r.employee.firstName} ${r.employee.lastName} | ${dateStr} | ` +
        `OLD: isLate=${r.isLate} late=${r.lateMinutes}m | ` +
        `NEW: isLate=${result.isLate} late=${result.lateMinutes}m`);
      
      await p.attendance.update({
        where: { id: r.id },
        data: { isLate: result.isLate, lateMinutes: result.lateMinutes },
      });
      fixed++;
    }
  }

  console.log(`\nDone. Fixed ${fixed} records.`);
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
