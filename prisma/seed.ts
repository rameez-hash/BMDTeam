import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Departments
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'MGMT' },
      update: {},
      create: { name: 'Management', code: 'MGMT', description: 'Top management' },
    }),
    prisma.department.upsert({
      where: { code: 'HR' },
      update: {},
      create: { name: 'Human Resources', code: 'HR', description: 'HR department' },
    }),
    prisma.department.upsert({
      where: { code: 'IT' },
      update: {},
      create: { name: 'Information Technology', code: 'IT', description: 'IT department' },
    }),
    prisma.department.upsert({
      where: { code: 'FIN' },
      update: {},
      create: { name: 'Finance', code: 'FIN', description: 'Finance department' },
    }),
    prisma.department.upsert({
      where: { code: 'SALES' },
      update: {},
      create: { name: 'Sales', code: 'SALES', description: 'Sales department' },
    }),
  ]);
  console.log('✅ Departments created');

  // Create Designations
  const designations = await Promise.all([
    prisma.designation.upsert({
      where: { code: 'CEO' },
      update: {},
      create: { name: 'Chief Executive Officer', code: 'CEO', level: 1 },
    }),
    prisma.designation.upsert({
      where: { code: 'MGR' },
      update: {},
      create: { name: 'Manager', code: 'MGR', level: 2 },
    }),
    prisma.designation.upsert({
      where: { code: 'TL' },
      update: {},
      create: { name: 'Team Lead', code: 'TL', level: 3 },
    }),
    prisma.designation.upsert({
      where: { code: 'SR_DEV' },
      update: {},
      create: { name: 'Senior Developer', code: 'SR_DEV', level: 4, departmentId: departments[2].id },
    }),
    prisma.designation.upsert({
      where: { code: 'JR_DEV' },
      update: {},
      create: { name: 'Junior Developer', code: 'JR_DEV', level: 5, departmentId: departments[2].id },
    }),
    prisma.designation.upsert({
      where: { code: 'HR_EXEC' },
      update: {},
      create: { name: 'HR Executive', code: 'HR_EXEC', level: 4, departmentId: departments[1].id },
    }),
  ]);
  console.log('✅ Designations created');

  // Create Shifts
  const shifts = await Promise.all([
    prisma.shift.upsert({
      where: { code: 'GENERAL' },
      update: {},
      create: { name: 'General Shift', code: 'GENERAL', startTime: '09:00', endTime: '18:00', breakDuration: 60, graceTime: 15 },
    }),
    prisma.shift.upsert({
      where: { code: 'MORNING' },
      update: {},
      create: { name: 'Morning Shift', code: 'MORNING', startTime: '06:00', endTime: '14:00', breakDuration: 30, graceTime: 10 },
    }),
    prisma.shift.upsert({
      where: { code: 'EVENING' },
      update: {},
      create: { name: 'Evening Shift', code: 'EVENING', startTime: '14:00', endTime: '22:00', breakDuration: 30, graceTime: 10 },
    }),
  ]);
  console.log('✅ Shifts created');

  // Create Leave Types
  await Promise.all([
    prisma.leaveType.upsert({
      where: { code: 'CL' },
      update: {},
      create: { name: 'Casual Leave', code: 'CL', annualAllocation: 12, isPaid: true },
    }),
    prisma.leaveType.upsert({
      where: { code: 'SL' },
      update: {},
      create: { name: 'Sick Leave', code: 'SL', annualAllocation: 10, isPaid: true },
    }),
    prisma.leaveType.upsert({
      where: { code: 'EL' },
      update: {},
      create: { name: 'Earned Leave', code: 'EL', annualAllocation: 15, isPaid: true, isCarryForward: true, maxCarryForward: 30 },
    }),
    prisma.leaveType.upsert({
      where: { code: 'LWP' },
      update: {},
      create: { name: 'Leave Without Pay', code: 'LWP', annualAllocation: 0, isPaid: false },
    }),
    prisma.leaveType.upsert({
      where: { code: 'ML' },
      update: {},
      create: { name: 'Maternity Leave', code: 'ML', annualAllocation: 180, isPaid: true },
    }),
    prisma.leaveType.upsert({
      where: { code: 'PL' },
      update: {},
      create: { name: 'Paternity Leave', code: 'PL', annualAllocation: 15, isPaid: true },
    }),
  ]);
  console.log('✅ Leave types created');

  // Create Late Rules
  await Promise.all([
    prisma.lateRule.upsert({
      where: { id: 'late-warning' },
      update: {},
      create: { id: 'late-warning', name: 'Warning', minLateCount: 1, maxLateCount: 2, deductionType: 'FIXED', deductionValue: 0, description: 'Warning for 1-2 late arrivals' },
    }),
    prisma.lateRule.upsert({
      where: { id: 'late-50' },
      update: {},
      create: { id: 'late-50', name: '50% Deduction', minLateCount: 3, maxLateCount: 4, deductionType: 'PERCENTAGE', deductionValue: 50, description: '50% salary deduction for 3-4 late arrivals' },
    }),
    prisma.lateRule.upsert({
      where: { id: 'late-100' },
      update: {},
      create: { id: 'late-100', name: 'Full Day Deduction', minLateCount: 5, maxLateCount: null, deductionType: 'DAYS', deductionValue: 1, description: '1 day salary deduction for 5+ late arrivals' },
    }),
  ]);
  console.log('✅ Late rules created');

  // Create Tax Slabs (Pakistan Finance Act 2025-26)
  const currentYear = new Date().getFullYear();
  await Promise.all([
    prisma.taxSlab.upsert({
      where: { id: `tax-0-${currentYear}` },
      update: { name: 'No Tax (Up to 6 Lakh)', minIncome: 0, maxIncome: 600000, fixedTax: 0, taxRate: 0 },
      create: { id: `tax-0-${currentYear}`, name: 'No Tax (Up to 6 Lakh)', minIncome: 0, maxIncome: 600000, fixedTax: 0, taxRate: 0, year: currentYear },
    }),
    prisma.taxSlab.upsert({
      where: { id: `tax-1-${currentYear}` },
      update: { name: '1% Slab (6-12 Lakh)', minIncome: 600000, maxIncome: 1200000, fixedTax: 0, taxRate: 1 },
      create: { id: `tax-1-${currentYear}`, name: '1% Slab (6-12 Lakh)', minIncome: 600000, maxIncome: 1200000, fixedTax: 0, taxRate: 1, year: currentYear },
    }),
    prisma.taxSlab.upsert({
      where: { id: `tax-11-${currentYear}` },
      update: { name: '11% Slab (12-22 Lakh)', minIncome: 1200000, maxIncome: 2200000, fixedTax: 6000, taxRate: 11 },
      create: { id: `tax-11-${currentYear}`, name: '11% Slab (12-22 Lakh)', minIncome: 1200000, maxIncome: 2200000, fixedTax: 6000, taxRate: 11, year: currentYear },
    }),
    prisma.taxSlab.upsert({
      where: { id: `tax-23-${currentYear}` },
      update: { name: '23% Slab (22-32 Lakh)', minIncome: 2200000, maxIncome: 3200000, fixedTax: 116000, taxRate: 23 },
      create: { id: `tax-23-${currentYear}`, name: '23% Slab (22-32 Lakh)', minIncome: 2200000, maxIncome: 3200000, fixedTax: 116000, taxRate: 23, year: currentYear },
    }),
    prisma.taxSlab.upsert({
      where: { id: `tax-30-${currentYear}` },
      update: { name: '30% Slab (32-41 Lakh)', minIncome: 3200000, maxIncome: 4100000, fixedTax: 346000, taxRate: 30 },
      create: { id: `tax-30-${currentYear}`, name: '30% Slab (32-41 Lakh)', minIncome: 3200000, maxIncome: 4100000, fixedTax: 346000, taxRate: 30, year: currentYear },
    }),
    prisma.taxSlab.upsert({
      where: { id: `tax-35-${currentYear}` },
      update: { name: '35% Slab (Above 41 Lakh)', minIncome: 4100000, maxIncome: null, fixedTax: 616000, taxRate: 35 },
      create: { id: `tax-35-${currentYear}`, name: '35% Slab (Above 41 Lakh)', minIncome: 4100000, maxIncome: null, fixedTax: 616000, taxRate: 35, year: currentYear },
    }),
  ]);
  console.log('✅ Tax slabs created (Pakistan 2025-26)');

  // Create Holidays (Pakistan)
  await Promise.all([
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-02-05`), name: 'Kashmir Day' } },
      update: {},
      create: { name: 'Kashmir Day', date: new Date(`${currentYear}-02-05`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-03-23`), name: 'Pakistan Day' } },
      update: {},
      create: { name: 'Pakistan Day', date: new Date(`${currentYear}-03-23`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-05-01`), name: 'Labour Day' } },
      update: {},
      create: { name: 'Labour Day', date: new Date(`${currentYear}-05-01`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-08-14`), name: 'Independence Day' } },
      update: {},
      create: { name: 'Independence Day', date: new Date(`${currentYear}-08-14`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-11-09`), name: 'Iqbal Day' } },
      update: {},
      create: { name: 'Iqbal Day', date: new Date(`${currentYear}-11-09`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-12-25`), name: 'Quaid-e-Azam Day' } },
      update: {},
      create: { name: 'Quaid-e-Azam Day', date: new Date(`${currentYear}-12-25`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-04-21`), name: 'Shab-e-Meraj' } },
      update: {},
      create: { name: 'Shab-e-Meraj', date: new Date(`${currentYear}-04-21`), type: 'PUBLIC', year: currentYear },
    }),
    prisma.holiday.upsert({
      where: { date_name: { date: new Date(`${currentYear}-09-27`), name: 'Eid Milad-un-Nabi' } },
      update: {},
      create: { name: 'Eid Milad-un-Nabi', date: new Date(`${currentYear}-09-27`), type: 'PUBLIC', year: currentYear },
    }),
  ]);
  console.log('✅ Holidays created (Pakistan)');

  // Create Admin User
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hrms.com' },
    update: {},
    create: {
      employeeId: 'ADMIN001',
      email: 'admin@hrms.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  await prisma.employee.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      employeeCode: 'ADMIN001',
      firstName: 'Ahmed',
      lastName: 'Khan',
      email: 'admin@hrms.com',
      phone: '+92 300 1234567',
      departmentId: departments[0].id, // Management
      designation: 'Chief Executive Officer', // CEO
      shiftId: shifts[0].id, // General Shift
      joiningDate: new Date('2020-01-01'),
      employmentType: 'PERMANENT',
      dateOfBirth: new Date('1985-06-15'),
      gender: 'MALE',
      city: 'Islamabad',
      state: 'ICT',
      country: 'Pakistan',
    },
  });
  console.log('✅ Admin user created');

  // Create HR User
  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@hrms.com' },
    update: {},
    create: {
      employeeId: 'HR001',
      email: 'hr@hrms.com',
      password: hashedPassword,
      role: 'HR',
    },
  });

  await prisma.employee.upsert({
    where: { userId: hrUser.id },
    update: {},
    create: {
      userId: hrUser.id,
      employeeCode: 'HR001',
      firstName: 'Fatima',
      lastName: 'Ali',
      email: 'hr@hrms.com',
      phone: '+92 321 9876543',
      departmentId: departments[1].id, // HR
      designation: 'HR Executive', // HR Executive
      shiftId: shifts[0].id,
      joiningDate: new Date('2021-03-15'),
      employmentType: 'PERMANENT',
      dateOfBirth: new Date('1990-03-20'),
      gender: 'FEMALE',
      city: 'Lahore',
      state: 'Punjab',
      country: 'Pakistan',
    },
  });
  console.log('✅ HR user created');

  // Create Sample Employee
  const empUser = await prisma.user.upsert({
    where: { email: 'employee@hrms.com' },
    update: {},
    create: {
      employeeId: 'EMP001',
      email: 'employee@hrms.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
    },
  });

  await prisma.employee.upsert({
    where: { userId: empUser.id },
    update: {},
    create: {
      userId: empUser.id,
      employeeCode: 'EMP001',
      firstName: 'Usman',
      lastName: 'Malik',
      email: 'employee@hrms.com',
      phone: '+92 333 5551234',
      departmentId: departments[2].id, // IT
      designation: 'Senior Developer', // Senior Developer
      shiftId: shifts[0].id,
      joiningDate: new Date('2022-06-01'),
      employmentType: 'PERMANENT',
      dateOfBirth: new Date('1995-08-10'),
      gender: 'MALE',
      city: 'Karachi',
      state: 'Sindh',
      country: 'Pakistan',
    },
  });
  console.log('✅ Sample employee created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Default login credentials:');
  console.log('   Admin:    admin@hrms.com / admin123');
  console.log('   HR:       hr@hrms.com / admin123');
  console.log('   Employee: employee@hrms.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
