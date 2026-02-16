import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default salary structures for different roles
const salaryData: Record<string, {
  basicSalary: number;
  hra: number;
  da: number;
  ta: number;
  medicalAllowance: number;
  otherAllowances: number;
  pf: number;
  esi: number;
  professionalTax: number;
  tds: number;
  otherDeductions: number;
}> = {
  'ADMIN001': {
    basicSalary: 80000,
    hra: 20000,
    da: 10000,
    ta: 5000,
    medicalAllowance: 5000,
    otherAllowances: 0,
    pf: 3000,
    esi: 0,
    professionalTax: 200,
    tds: 0,
    otherDeductions: 0,
  },
  'HR001': {
    basicSalary: 60000,
    hra: 15000,
    da: 8000,
    ta: 4000,
    medicalAllowance: 3000,
    otherAllowances: 0,
    pf: 2500,
    esi: 0,
    professionalTax: 200,
    tds: 0,
    otherDeductions: 0,
  },
  'EMP001': {
    basicSalary: 50000,
    hra: 12000,
    da: 6000,
    ta: 3000,
    medicalAllowance: 2500,
    otherAllowances: 0,
    pf: 2000,
    esi: 0,
    professionalTax: 200,
    tds: 0,
    otherDeductions: 0,
  },
};

async function seedSalaries() {
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, salary: true },
  });

  console.log(`Found ${employees.length} active employees\n`);

  for (const emp of employees) {
    if (emp.salary) {
      console.log(`✓ ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - Salary already assigned`);
      continue;
    }

    const data = salaryData[emp.employeeCode] || salaryData['EMP001'];
    const grossSalary = data.basicSalary + data.hra + data.da + data.ta + data.medicalAllowance + data.otherAllowances;
    const totalDeductions = data.pf + data.esi + data.professionalTax + data.tds + data.otherDeductions;
    const netSalary = grossSalary - totalDeductions;

    await prisma.salary.create({
      data: {
        employeeId: emp.id,
        ...data,
        grossSalary,
        netSalary,
        effectiveFrom: new Date('2026-01-01'),
      },
    });

    console.log(`✓ ${emp.firstName} ${emp.lastName} (${emp.employeeCode}) - Salary assigned: Gross ${grossSalary}, Net ${netSalary}`);
  }

  console.log('\nDone! All salaries assigned.');
  await prisma.$disconnect();
}

seedSalaries().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
