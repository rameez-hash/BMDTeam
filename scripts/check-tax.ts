import prisma from '../lib/prisma';

async function main() {
  const slabs = await prisma.taxSlab.findMany({ where: { isActive: true }, orderBy: { minIncome: 'asc' } });
  console.log('\n=== Active Tax Slabs ===');
  slabs.forEach(s => console.log(`Min: ${s.minIncome}, Max: ${s.maxIncome}, Fixed: ${s.fixedTax}, Rate: ${s.taxRate}%`));

  const emps = await prisma.employee.findMany({ include: { salary: true } });
  console.log('\n=== Employee Salaries ===');
  emps.forEach(e => {
    if (e.salary) {
      const annual = e.salary.grossSalary * 12;
      console.log(`${e.firstName} ${e.lastName} (${e.employeeCode}): Gross=${e.salary.grossSalary}/mo, Annual=${annual}, Stored TDS=${e.salary.tds}`);
      
      // Manual calculation
      const sortedSlabs = [...slabs].sort((a, b) => b.minIncome - a.minIncome);
      const applicableSlab = sortedSlabs.find(slab => annual > slab.minIncome);
      if (applicableSlab && applicableSlab.taxRate > 0) {
        const exceeding = annual - applicableSlab.minIncome;
        const fixed = applicableSlab.fixedTax || 0;
        const variable = exceeding * (applicableSlab.taxRate / 100);
        let annualTax = fixed + variable;
        if (annual > 10000000) annualTax *= 1.09;
        const monthlyTax = Math.round(annualTax / 12 * 100) / 100;
        console.log(`  Slab: Min=${applicableSlab.minIncome}, Fixed=${fixed}, Rate=${applicableSlab.taxRate}%`);
        console.log(`  Exceeding: ${exceeding}, Annual Tax: ${annualTax}, Monthly Tax: ${monthlyTax}`);
      } else {
        console.log('  No tax applicable (below threshold or no slab found)');
      }
    } else {
      console.log(`${e.firstName} ${e.lastName} (${e.employeeCode}): No salary configured`);
    }
  });

  // Check payroll records
  const payrolls = await prisma.payrollRecord.findMany({
    include: { employee: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
  console.log('\n=== Payroll Records ===');
  payrolls.forEach(p => {
    console.log(`${p.employee.firstName} ${p.employee.lastName} ${p.month}/${p.year}: TDS=${p.tds}, Gross=${p.grossEarnings}, Net=${p.netSalary}, Status=${p.status}`);
  });

  await prisma.$disconnect();
}

main();
