import prisma from '../lib/prisma';

async function main() {
  // 1. Delete all old late rules
  const deleted = await prisma.lateRule.deleteMany({});
  console.log(`Deleted ${deleted.count} old late rules`);

  // 2. Create the standard late rule: Every 4 lates = 1 day deduction
  const rule = await prisma.lateRule.create({
    data: {
      name: 'Standard Late Policy',
      minLateCount: 4,
      maxLateCount: null, // No upper limit
      deductionType: 'PER_LATE_DAYS',
      deductionValue: 4, // Every 4 lates = 1 day
      description: 'Every 4 late arrivals = 1 day salary deduction. 1-3 lates = no deduction.',
      isActive: true,
    },
  });
  console.log(`Created late rule: ${rule.name} (Every ${rule.deductionValue} lates = 1 day deduction)`);

  // 3. Delete all old payroll records
  const deletedManual = await prisma.manualDeduction.deleteMany({});
  console.log(`Deleted ${deletedManual.count} manual deductions`);
  
  const deletedPayroll = await prisma.payrollRecord.deleteMany({});
  console.log(`Deleted ${deletedPayroll.count} old payroll records`);

  // 4. Fix employee salaries - recalculate TDS using current tax slabs
  const taxSlabs = await prisma.taxSlab.findMany({ where: { isActive: true }, orderBy: { minIncome: 'asc' } });
  const employees = await prisma.employee.findMany({ include: { salary: true } });

  for (const emp of employees) {
    if (!emp.salary) continue;
    
    const annualIncome = emp.salary.grossSalary * 12;
    const sortedSlabs = [...taxSlabs].sort((a, b) => b.minIncome - a.minIncome);
    const applicableSlab = sortedSlabs.find(slab => annualIncome > slab.minIncome);
    
    let monthlyTax = 0;
    if (applicableSlab && applicableSlab.taxRate > 0) {
      const exceeding = annualIncome - applicableSlab.minIncome;
      const fixed = applicableSlab.fixedTax || 0;
      const variable = exceeding * (applicableSlab.taxRate / 100);
      let annualTax = fixed + variable;
      if (annualIncome > 10000000) annualTax *= 1.09;
      monthlyTax = Math.round(annualTax / 12 * 100) / 100;
    }

    await prisma.salary.update({
      where: { employeeId: emp.id },
      data: { 
        tds: monthlyTax,
        netSalary: emp.salary.grossSalary - emp.salary.pf - emp.salary.esi - emp.salary.professionalTax - monthlyTax - emp.salary.otherDeductions,
      },
    });
    console.log(`Updated ${emp.employeeCode} ${emp.firstName}: TDS=${monthlyTax}/mo (Annual Income: ${annualIncome})`);
  }

  console.log('\n✅ Done! Now generate payroll from the Payroll page.');
  await prisma.$disconnect();
}

main();
