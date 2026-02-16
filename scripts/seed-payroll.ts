import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get all employees (exclude ADMIN)
  const employees = await prisma.employee.findMany({
    where: { user: { role: { not: 'ADMIN' } } },
    include: { 
      salary: true,
      department: { select: { name: true } },
    },
  });

  console.log(`Found ${employees.length} employees`);

  // First, ensure all employees have salaries
  for (const emp of employees) {
    if (!emp.salary) {
      const isHR = emp.employeeCode?.startsWith('HR');
      const basicSalary = isHR ? 80000 : 55000;
      const hra = Math.round(basicSalary * 0.15);
      const da = Math.round(basicSalary * 0.05);
      const ta = 3000;
      const medicalAllowance = 2500;
      const otherAllowances = 1500;
      const pf = Math.round(basicSalary * 0.05);
      const professionalTax = 200;
      const tds = Math.round(basicSalary * 0.03);
      const grossSalary = basicSalary + hra + da + ta + medicalAllowance + otherAllowances;
      const netSalary = grossSalary - pf - professionalTax - tds;

      const sal = await prisma.salary.create({
        data: {
          employeeId: emp.id,
          basicSalary, hra, da, ta, medicalAllowance, otherAllowances,
          grossSalary, netSalary, pf, professionalTax, tds,
          effectiveFrom: new Date('2025-01-01'),
        },
      });
      emp.salary = sal as any;
      console.log(`💰 Created salary for ${emp.employeeCode}: Gross=${grossSalary} Net=${netSalary}`);
    }
  }

  // Check existing payroll
  const existing = await prisma.payrollRecord.findMany({
    select: { employeeId: true, month: true, year: true },
  });
  console.log(`Existing payroll records: ${existing.length}`);

  // We'll seed January 2026 and December 2025
  const months = [
    { month: 12, year: 2025, workingDays: 23 },
    { month: 1, year: 2026, workingDays: 22 },
  ];

  let created = 0;
  let skipped = 0;

  for (const emp of employees) {
    if (!emp.salary) {
      console.log(`⚠️  ${emp.employeeCode} ${emp.firstName} ${emp.lastName} - No salary configured, skipping`);
      continue;
    }

    const sal = emp.salary;

    for (const period of months) {
      // Skip if already exists
      const alreadyExists = existing.find(
        (e) => e.employeeId === emp.id && e.month === period.month && e.year === period.year
      );
      if (alreadyExists) {
        console.log(`⏭️  ${emp.employeeCode} - ${period.month}/${period.year} already exists`);
        skipped++;
        continue;
      }

      // Randomize attendance slightly for realistic data
      const presentDays = period.workingDays - Math.floor(Math.random() * 4); // 0-3 absent
      const leaveDays = Math.floor(Math.random() * 3); // 0-2 leaves
      const absentDays = period.workingDays - presentDays - leaveDays;
      const lateDays = Math.floor(Math.random() * 5); // 0-4 late days

      // Calculate per-day rate
      const dailyRate = sal.grossSalary / period.workingDays;

      // Deductions
      const absentDeduction = Math.round(absentDays * dailyRate * 100) / 100;
      const lateDeduction = Math.round(lateDays * 200 * 100) / 100; // Rs 200 per late

      // Overtime (random, some months have it)
      const overtime = Math.random() > 0.6 ? Math.round(Math.random() * 5000) : 0;

      // Bonus (rare)
      const bonus = Math.random() > 0.85 ? Math.round(Math.random() * 3000) : 0;

      // Gross earnings
      const grossEarnings = sal.basicSalary + sal.hra + sal.da + sal.ta + 
                           sal.medicalAllowance + sal.otherAllowances + overtime + bonus;

      // Total deductions
      const totalDeductions = sal.pf + sal.esi + sal.professionalTax + sal.tds + 
                             sal.otherDeductions + absentDeduction + lateDeduction;

      const netSalary = Math.round((grossEarnings - totalDeductions) * 100) / 100;

      // Status: Dec 2025 = PAID, Jan 2026 = PROCESSED
      const status = period.month === 12 ? 'PAID' : 'PROCESSED';
      const paidAt = status === 'PAID' ? new Date('2026-01-05') : null;

      await prisma.payrollRecord.create({
        data: {
          employeeId: emp.id,
          month: period.month,
          year: period.year,
          workingDays: period.workingDays,
          presentDays,
          leaveDays,
          absentDays: absentDays < 0 ? 0 : absentDays,
          lateDays,
          basicSalary: sal.basicSalary,
          hra: sal.hra,
          da: sal.da,
          ta: sal.ta,
          medicalAllowance: sal.medicalAllowance,
          otherAllowances: sal.otherAllowances,
          overtime,
          bonus,
          pf: sal.pf,
          esi: sal.esi,
          professionalTax: sal.professionalTax,
          tds: sal.tds,
          lateDeduction,
          absentDeduction: absentDeduction < 0 ? 0 : absentDeduction,
          otherDeductions: sal.otherDeductions,
          grossEarnings,
          totalDeductions,
          netSalary: netSalary < 0 ? 0 : netSalary,
          status,
          paidAt,
          generatedAt: new Date(`${period.year}-${String(period.month).padStart(2, '0')}-28`),
        },
      });

      console.log(`✅ ${emp.employeeCode} ${emp.firstName} ${emp.lastName} | ${period.month}/${period.year} | Gross: ${grossEarnings.toLocaleString()} | Net: ${netSalary.toLocaleString()} | Status: ${status}`);
      created++;
    }
  }

  console.log(`\n📊 Summary: Created ${created} payroll records, Skipped ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
