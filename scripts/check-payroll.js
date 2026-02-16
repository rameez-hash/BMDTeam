const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. Late Rules
  const rules = await p.lateRule.findMany();
  console.log('=== Late Rules ===');
  rules.forEach(r => console.log({
    name: r.name, type: r.deductionType, value: r.deductionValue,
    deductionDays: r.deductionDays, active: r.isActive, min: r.minLateCount, max: r.maxLateCount
  }));

  // 2. Feb 2026 Attendance Summary
  const att = await p.attendance.findMany({
    where: { date: { gte: new Date('2026-02-01'), lte: new Date('2026-02-28') } },
    include: { employee: { select: { firstName: true, lastName: true } } }
  });
  const byEmp = {};
  att.forEach(a => {
    const n = a.employee.firstName + ' ' + a.employee.lastName;
    if (!byEmp[n]) byEmp[n] = { present: 0, halfDay: 0, late: 0, absent: 0, leave: 0, total: 0 };
    byEmp[n].total++;
    if (a.status === 'PRESENT') byEmp[n].present++;
    if (a.status === 'HALF_DAY') byEmp[n].halfDay++;
    if (a.status === 'ON_LEAVE') byEmp[n].leave++;
    if (a.status === 'ABSENT') byEmp[n].absent++;
    if (a.isLate) byEmp[n].late++;
  });
  console.log('\n=== Feb 2026 Attendance Summary ===');
  Object.entries(byEmp).forEach(([n, s]) => console.log(n, s));

  // 3. Salaries
  const sal = await p.salary.findMany({ include: { employee: { select: { firstName: true, lastName: true } } } });
  console.log('\n=== Salaries ===');
  sal.forEach(s => console.log(s.employee.firstName, s.employee.lastName, 'gross:', s.grossSalary));

  // 4. Existing Feb payroll
  const payroll = await p.payrollRecord.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { firstName: true, lastName: true } } }
  });
  console.log('\n=== Existing Feb 2026 Payroll ===');
  payroll.forEach(pr => console.log({
    name: pr.employee.firstName + ' ' + pr.employee.lastName,
    gross: pr.grossEarnings, net: pr.netSalary,
    present: pr.presentDays, absent: pr.absentDays, halfDays: pr.halfDays,
    late: pr.lateDays, leave: pr.leaveDays,
    lateDeduction: pr.lateDeduction, absentDeduction: pr.absentDeduction,
    status: pr.status
  }));

  // 5. Holidays in Feb
  const holidays = await p.holiday.findMany({
    where: { date: { gte: new Date('2026-02-01'), lte: new Date('2026-02-28') } }
  });
  console.log('\n=== Feb 2026 Holidays ===');
  holidays.forEach(h => console.log(h.name, h.date.toISOString().slice(0, 10)));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
