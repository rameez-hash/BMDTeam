const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // 1. Tax Slabs
  const slabs = await p.taxSlab.findMany({ where: { isActive: true }, orderBy: { minIncome: 'asc' } });
  console.log('=== TAX SLABS ===');
  slabs.forEach(s => {
    console.log('  ' + s.name + ': min=' + s.minIncome + ' max=' + (s.maxIncome || 'unlimited') + ' fixed=' + s.fixedTax + ' rate=' + s.taxRate + '% year=' + s.year);
  });

  // 2. Sample Salaries
  const sals = await p.salary.findMany({ take: 5, include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } } });
  console.log('\n=== SALARIES ===');
  sals.forEach(s => {
    console.log('  ' + s.employee.firstName + ' ' + s.employee.lastName + ' (' + s.employee.employeeCode + '): basic=' + s.basicSalary + ' gross=' + s.grossSalary + ' pf=' + s.pf + ' esi=' + s.esi + ' profTax=' + s.professionalTax + ' tds=' + s.tds + ' otherDed=' + s.otherDeductions);
  });

  // 3. Late Rules
  const rules = await p.lateRule.findMany({ where: { isActive: true }, orderBy: { minLateCount: 'asc' } });
  console.log('\n=== LATE RULES ===');
  rules.forEach(r => {
    console.log('  min=' + r.minLateCount + ' max=' + (r.maxLateCount || 'unlimited') + ' type=' + r.deductionType + ' value=' + r.deductionValue + ' days=' + (r.deductionDays || 'N/A'));
  });

  // 4. Recent Payroll Records
  const payrolls = await p.payrollRecord.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { employee: { select: { firstName: true, lastName: true } } }
  });
  console.log('\n=== RECENT PAYROLL RECORDS ===');
  payrolls.forEach(r => {
    console.log('  ' + r.employee.firstName + ' ' + r.employee.lastName + ' (' + r.month + '/' + r.year + '):');
    console.log('    workDays=' + r.workingDays + ' present=' + r.presentDays + ' absent=' + r.absentDays + ' halfDays=' + r.halfDays + ' leave=' + r.leaveDays + ' late=' + r.lateDays);
    console.log('    gross=' + r.grossEarnings + ' tds=' + r.tds + ' lateDeduct=' + r.lateDeduction + ' absentDeduct=' + r.absentDeduction + ' otherDed=' + r.otherDeductions);
    console.log('    totalDeductions=' + r.totalDeductions + ' netSalary=' + r.netSalary + ' status=' + r.status);
    var dailyRate = r.workingDays > 0 ? r.grossEarnings / r.workingDays : 0;
    console.log('    [CALC CHECK] dailyRate=' + dailyRate.toFixed(2) + ' expectedAbsentDeduct=' + (r.absentDays * dailyRate).toFixed(2) + ' actualAbsentDeduct=' + r.absentDeduction);
    var expectedTotal = (r.pf || 0) + (r.esi || 0) + (r.professionalTax || 0) + r.tds + r.lateDeduction + r.absentDeduction + (r.otherDeductions || 0);
    console.log('    [CALC CHECK] expectedTotalDeductions=' + expectedTotal.toFixed(2) + ' actual=' + r.totalDeductions);
    var expectedNet = r.grossEarnings - r.totalDeductions;
    console.log('    [CALC CHECK] expectedNet=' + expectedNet.toFixed(2) + ' actual=' + r.netSalary);
  });

  // 5. Verify tax calculation for a sample
  if (sals.length > 0 && slabs.length > 0) {
    console.log('\n=== TAX VERIFICATION ===');
    sals.forEach(s => {
      var annualIncome = s.grossSalary * 12;
      var sortedSlabs = slabs.slice().sort(function(a, b) { return b.minIncome - a.minIncome; });
      var applicable = sortedSlabs.find(function(slab) { return annualIncome > slab.minIncome; });
      if (!applicable || applicable.taxRate === 0) {
        console.log('  ' + s.employee.firstName + ': gross=' + s.grossSalary + '/mo annual=' + annualIncome + ' → NO TAX (below threshold)');
      } else {
        var exceeding = annualIncome - applicable.minIncome;
        var fixedTax = applicable.fixedTax || 0;
        var variableTax = exceeding * (applicable.taxRate / 100);
        var totalAnnual = fixedTax + variableTax;
        if (annualIncome > 10000000) totalAnnual = totalAnnual * 1.09;
        var monthlyTax = Math.round(totalAnnual / 12 * 100) / 100;
        console.log('  ' + s.employee.firstName + ': gross=' + s.grossSalary + '/mo annual=' + annualIncome + ' → slab="' + applicable.name + '" exceeding=' + exceeding + ' fixedTax=' + fixedTax + ' variableTax=' + variableTax.toFixed(2) + ' annualTax=' + totalAnnual.toFixed(2) + ' → monthlyTDS=' + monthlyTax + ' (stored=' + s.tds + ')');
      }
    });
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
