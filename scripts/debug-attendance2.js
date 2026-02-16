const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

(async () => {
  const userId = '359b63d3-4981-4f72-b900-edc061265535'; // Usman's userId
  
  // Simulate API: GET /attendance?startDate=2026-02-01&endDate=2026-02-28&limit=100
  const startDate = '2026-02-01';
  const endDate = '2026-02-28';
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Step 1: Real attendance records (filtered by userId)
  const attendance = await p.attendance.findMany({
    where: {
      date: { gte: start, lte: end },
      employee: { userId: userId },
    },
    include: {
      employee: {
        select: {
          id: true, firstName: true, lastName: true, employeeCode: true,
          department: { select: { name: true } },
          shift: { select: { name: true, startTime: true, endTime: true, workDays: true } },
        },
      },
      breaks: true,
    },
    orderBy: { date: 'desc' },
  });
  
  console.log('=== REAL ATTENDANCE RECORDS ===');
  console.log('Count:', attendance.length);
  attendance.forEach(r => console.log({
    date: formatDate(r.date),
    status: r.status,
    checkIn: r.checkIn?.toISOString() || null,
    employee: r.employee.firstName,
  }));

  // Step 2: Get employees matching empWhere
  const allEmployees = await p.employee.findMany({
    where: { userId: userId },
    select: {
      id: true, firstName: true, lastName: true, employeeCode: true,
      joiningDate: true,
      department: { select: { name: true } },
      shift: { select: { workDays: true } },
    },
  });
  
  console.log('\n=== EMPLOYEES MATCHING empWhere ===');
  console.log('Count:', allEmployees.length);
  allEmployees.forEach(e => console.log(e.firstName, e.lastName, e.employeeCode));

  // Step 3: Generate special records
  const specialRecords = [];
  const holidays = await p.holiday.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const holidayMap = new Map();
  holidays.forEach(h => holidayMap.set(formatDate(h.date), h.name));

  function getWorkDays(wd) {
    if (!wd) return [1, 2, 3, 4, 5];
    if (typeof wd === 'string') {
      try { return JSON.parse(wd); } catch { return [1, 2, 3, 4, 5]; }
    }
    return wd;
  }

  for (const emp of allEmployees) {
    const empWorkDays = getWorkDays(emp.shift?.workDays);
    const empJoinDate = emp.joiningDate ? new Date(emp.joiningDate) : null;
    const rangeStart = empJoinDate && empJoinDate > start ? empJoinDate : start;
    const currentDate = new Date(rangeStart);
    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      const dateStr = formatDate(currentDate);
      const existingRecord = attendance.find(
        a => a.employeeId === emp.id && formatDate(a.date) === dateStr
      );
      if (!existingRecord) {
        if (!empWorkDays.includes(dayOfWeek)) {
          specialRecords.push({ date: dateStr, status: 'WEEKEND', emp: emp.firstName });
        } else if (holidayMap.has(dateStr)) {
          specialRecords.push({ date: dateStr, status: 'HOLIDAY', emp: emp.firstName, holiday: holidayMap.get(dateStr) });
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (new Date(currentDate) < today) {
            specialRecords.push({ date: dateStr, status: 'ABSENT', emp: emp.firstName });
          }
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  console.log('\n=== GENERATED SPECIAL RECORDS ===');
  console.log('Count:', specialRecords.length);
  const byStat = {};
  specialRecords.forEach(r => {
    byStat[r.status] = (byStat[r.status] || 0) + 1;
  });
  console.log('By status:', byStat);
  specialRecords.forEach(r => console.log(`${r.date} - ${r.status} (${r.emp})`));

  // Step 4: Combined
  const allRecords = [...attendance.map(r => ({
    date: formatDate(r.date),
    status: r.status,
    emp: r.employee.firstName,
  })), ...specialRecords];
  
  console.log('\n=== COMBINED ALL RECORDS ===');
  console.log('Total:', allRecords.length);
  const byStatus = {};
  allRecords.forEach(r => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
  console.log('By status:', byStatus);

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
