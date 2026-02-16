const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const p = new PrismaClient();

(async () => {
  console.log('=== PAYROLL SYSTEM TEST ===\n');

  // 1. Check employees with salaries
  const emps = await p.employee.findMany({
    where: { employmentStatus: 'ACTIVE', user: { role: { not: 'ADMIN' } } },
    include: { salary: true, shift: true, department: { select: { name: true } }, user: { select: { role: true } } }
  });
  console.log(`Active non-admin employees: ${emps.length}`);
  for (const e of emps) {
    console.log(`  - ${e.firstName} ${e.lastName} (${e.employeeCode}) | Dept: ${e.department?.name || 'N/A'} | Salary: ${e.salary ? 'Gross=' + e.salary.grossSalary + ', Net=' + e.salary.netSalary : 'NOT SET'}`);
    if (e.salary) {
      console.log(`    Basic=${e.salary.basicSalary}, HRA=${e.salary.hra}, DA=${e.salary.da}, TA=${e.salary.ta}, Medical=${e.salary.medicalAllowance}, Other=${e.salary.otherAllowances}`);
      console.log(`    PF=${e.salary.pf}, ESI=${e.salary.esi}, ProfTax=${e.salary.professionalTax}, TDS=${e.salary.tds}, OtherDed=${e.salary.otherDeductions}`);
    }
    if (e.shift) console.log(`    Shift: ${e.shift.name} (${e.shift.startTime}-${e.shift.endTime}), WorkDays: ${e.shift.workDays}`);
  }

  // 2. Check tax slabs
  const slabs = await p.taxSlab.findMany({ where: { isActive: true }, orderBy: { minIncome: 'asc' } });
  console.log(`\nActive tax slabs: ${slabs.length}`);
  slabs.forEach(s => console.log(`  ${s.name}: ${s.minIncome} - ${s.maxIncome || 'unlimited'} → fixed=${s.fixedTax}, rate=${s.taxRate}%`));

  // 3. Check late rules
  const rules = await p.lateRule.findMany({ where: { isActive: true }, orderBy: { minLateCount: 'asc' } });
  console.log(`\nActive late rules: ${rules.length}`);
  rules.forEach(r => console.log(`  ${r.minLateCount}-${r.maxLateCount || '∞'} lates → ${r.deductionType} = ${r.deductionValue}`));

  // 4. Check holidays in Feb 2026
  const holidays = await p.holiday.findMany({ where: { date: { gte: new Date('2026-02-01'), lte: new Date('2026-02-28') }, isOptional: false } });
  console.log(`\nFeb 2026 holidays: ${holidays.length}`);
  holidays.forEach(h => console.log(`  ${h.date.toISOString().split('T')[0]}: ${h.name}`));

  // 5. Check attendance for Feb 2026
  console.log('\nFeb 2026 attendance:');
  for (const e of emps) {
    const att = await p.attendance.findMany({ where: { employeeId: e.id, date: { gte: new Date('2026-02-01'), lte: new Date('2026-02-28') } } });
    const present = att.filter(a => a.status === 'PRESENT' || a.status === 'HALF_DAY').length;
    const half = att.filter(a => a.status === 'HALF_DAY').length;
    const leave = att.filter(a => a.status === 'ON_LEAVE').length;
    const late = att.filter(a => a.isLate).length;
    console.log(`  ${e.firstName}: ${att.length} total records | Present=${present}, HalfDay=${half}, Leave=${leave}, Late=${late}`);
  }

  // 6. Check existing payroll records
  const payroll = await p.payrollRecord.findMany({
    where: { month: 2, year: 2026 },
    include: { employee: { select: { firstName: true, lastName: true } }, manualDeductions: true }
  });
  console.log(`\nExisting Feb 2026 payroll: ${payroll.length}`);
  payroll.forEach(pr => {
    console.log(`  ${pr.employee.firstName} ${pr.employee.lastName}: Status=${pr.status}`);
    console.log(`    WorkDays=${pr.workingDays}, Present=${pr.presentDays}, Leave=${pr.leaveDays}, Absent=${pr.absentDays}, HalfDays=${pr.halfDays}, Late=${pr.lateDays}`);
    console.log(`    Gross=${pr.grossEarnings}, Deductions=${pr.totalDeductions}, Net=${pr.netSalary}`);
    console.log(`    TDS=${pr.tds}, PF=${pr.pf}, ESI=${pr.esi}, LateDeduction=${pr.lateDeduction}, AbsentDeduction=${pr.absentDeduction}, ManualDeduction=${pr.manualDeduction}`);
    if (pr.manualDeductions.length > 0) {
      pr.manualDeductions.forEach(d => console.log(`    ManualDed: ${d.label} = ${d.amount} (${d.reason || 'no reason'})`));
    }
  });

  // 7. Test generating payroll via API
  const adminUser = await p.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, role: true } });
  const token = jwt.sign({ userId: adminUser.id, role: adminUser.role }, 'your-super-secret-jwt-key-change-this-in-production', { expiresIn: '1h' });

  // Delete existing draft payroll first
  if (payroll.length > 0) {
    console.log('\nDeleting existing DRAFT payroll records...');
    const delRes = await fetch('http://localhost:3000/api/payroll?all=true&month=2&year=2026', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const delData = await delRes.json();
    console.log('Delete result:', JSON.stringify(delData));
  }

  // Generate payroll
  console.log('\nGenerating payroll for Feb 2026...');
  const genRes = await fetch('http://localhost:3000/api/payroll', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ month: 2, year: 2026 })
  });
  const genData = await genRes.json();
  console.log('Generate status:', genRes.status);
  if (genData.success) {
    console.log(`Generated ${genData.data.length} records`);
    genData.data.forEach(r => {
      console.log(`  ${r.employee.firstName} ${r.employee.lastName}:`);
      console.log(`    WorkDays=${r.workingDays}, Present=${r.presentDays}, HalfDays=${r.halfDays}, Leave=${r.leaveDays}, Absent=${r.absentDays}, Late=${r.lateDays}`);
      console.log(`    GrossEarnings=${r.grossEarnings}, TotalDeductions=${r.totalDeductions}, NetSalary=${r.netSalary}`);
      console.log(`    TDS=${r.tds}, PF=${r.pf}, ESI=${r.esi}, ProfTax=${r.professionalTax}`);
      console.log(`    LateDeduction=${r.lateDeduction}, AbsentDeduction=${r.absentDeduction}`);
      
      // Verify calculations
      const expectedGross = r.basicSalary + (r.hra||0) + (r.da||0) + (r.ta||0) + (r.medicalAllowance||0) + (r.otherAllowances||0);
      const expectedDeductions = (r.pf||0) + (r.esi||0) + (r.professionalTax||0) + (r.tds||0) + (r.lateDeduction||0) + (r.absentDeduction||0) + (r.otherDeductions||0) + (r.manualDeduction||0);
      const expectedNet = Math.max(0, expectedGross - expectedDeductions);
      
      if (Math.abs(r.grossEarnings - expectedGross) > 0.01) console.log('    ⚠️ GROSS MISMATCH! Expected:', expectedGross, 'Got:', r.grossEarnings);
      if (Math.abs(r.totalDeductions - expectedDeductions) > 0.01) console.log('    ⚠️ DEDUCTIONS MISMATCH! Expected:', expectedDeductions, 'Got:', r.totalDeductions);
      if (Math.abs(r.netSalary - expectedNet) > 0.01) console.log('    ⚠️ NET MISMATCH! Expected:', expectedNet, 'Got:', r.netSalary);
      if (Math.abs(r.grossEarnings - expectedGross) < 0.01 && Math.abs(r.totalDeductions - expectedDeductions) < 0.01 && Math.abs(r.netSalary - expectedNet) < 0.01) {
        console.log('    ✅ All calculations correct');
      }
    });
  } else {
    console.log('Error:', genData.error);
  }

  // 8. Test payslip generation
  console.log('\nTesting payslip generation...');
  const payslipRes = await fetch('http://localhost:3000/api/payroll/payslip?month=2&year=2026', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Payslip status:', payslipRes.status);
  if (payslipRes.ok) {
    const contentType = payslipRes.headers.get('content-type');
    console.log('Content-Type:', contentType);
    if (contentType && contentType.includes('text/html')) {
      const html = await payslipRes.text();
      console.log('Payslip HTML length:', html.length, 'chars');
      console.log('Contains payslip-container:', html.includes('payslip-container'));
      console.log('Contains Net Salary:', html.includes('Net Salary'));
    }
  } else {
    const errData = await payslipRes.json();
    console.log('Payslip error:', errData.error);
  }

  console.log('\n=== TEST COMPLETE ===');
  await p.$disconnect();
})();
