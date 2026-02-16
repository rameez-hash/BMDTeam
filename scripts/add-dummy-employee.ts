/**
 * Script to add a dummy employee with Rs 230,000 monthly salary
 * Run with: npx tsx scripts/add-dummy-employee.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Adding dummy employee with Rs 230,000 monthly salary...\n');

  // Get first department and designation
  const department = await prisma.department.findFirst();
  const designation = await prisma.designation.findFirst();
  const shift = await prisma.shift.findFirst();

  if (!department || !designation) {
    console.error('❌ No departments or designations found. Please run main seed first.');
    process.exit(1);
  }

  // Check if employee already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'ahmed.khan@company.com' },
  });

  if (existingUser) {
    console.log('⚠️  Employee already exists. Updating salary...');
    
    const employee = await prisma.employee.findUnique({
      where: { userId: existingUser.id },
      include: { salary: true },
    });

    if (employee) {
      // Update salary
      const basicSalary = 150000;
      const hra = 30000;
      const da = 20000;
      const ta = 15000;
      const medicalAllowance = 10000;
      const otherAllowances = 5000;
      
      const grossSalary = basicSalary + hra + da + ta + medicalAllowance + otherAllowances;
      
      const pf = basicSalary * 0.12; // 12% of basic
      const esi = 0;
      const professionalTax = 200;
      
      // Calculate TDS based on annual income
      const annualIncome = grossSalary * 12; // Rs 2,760,000
      // Tax calculation: Rs 116,000 + 23% of (2,760,000 - 2,200,000) = Rs 116,000 + Rs 128,800 = Rs 244,800
      const annualTax = 116000 + ((annualIncome - 2200000) * 0.23);
      const monthlyTax = annualTax / 12; // Rs 20,400
      
      const totalDeductions = pf + esi + professionalTax + monthlyTax;
      const netSalary = grossSalary - totalDeductions;

      if (employee.salary) {
        await prisma.salary.update({
          where: { employeeId: employee.id },
          data: {
            basicSalary,
            hra,
            da,
            ta,
            medicalAllowance,
            otherAllowances,
            grossSalary,
            pf,
            esi,
            professionalTax,
            tds: monthlyTax,
            otherDeductions: 0,
            netSalary,
          },
        });
      } else {
        await prisma.salary.create({
          data: {
            employeeId: employee.id,
            basicSalary,
            hra,
            da,
            ta,
            medicalAllowance,
            otherAllowances,
            grossSalary,
            pf,
            esi,
            professionalTax,
            tds: monthlyTax,
            otherDeductions: 0,
            netSalary,
            effectiveFrom: new Date('2026-01-01'),
          },
        });
      }

      console.log('✅ Salary updated successfully!');
      console.log('\n📊 Salary Breakdown:');
      console.log(`   Gross Salary: Rs ${grossSalary.toLocaleString()}/month`);
      console.log(`   TDS (Annual Tax ÷ 12): Rs ${Math.round(monthlyTax).toLocaleString()}/month`);
      console.log(`   Total Deductions: Rs ${Math.round(totalDeductions).toLocaleString()}/month`);
      console.log(`   Net Salary: Rs ${Math.round(netSalary).toLocaleString()}/month`);
    }
    return;
  }

  // Create new user and employee
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      employeeId: 'EMP-002',
      email: 'ahmed.khan@company.com',
      password: hashedPassword,
      role: 'EMPLOYEE',
    },
  });

  const employee = await prisma.employee.create({
    data: {
      userId: user.id,
      employeeCode: 'EMP-002',
      firstName: 'Ahmed',
      lastName: 'Khan',
      email: 'ahmed.khan@company.com',
      phone: '+92-300-1234567',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'MALE',
      maritalStatus: 'MARRIED',
      nationality: 'Pakistani',
      address: '123 Main Street, Lahore',
      city: 'Lahore',
      state: 'Punjab',
      country: 'Pakistan',
      zipCode: '54000',
      departmentId: department.id,
      designation: designation.name,
      shiftId: shift?.id,
      joiningDate: new Date('2024-01-01'),
      employmentStatus: 'ACTIVE',
      employmentType: 'PERMANENT',
      bankName: 'Meezan Bank',
      bankAccountNumber: '1234567890',
      ifscCode: 'MEZN0001234',
    },
  });

  // Create salary - Rs 230,000 gross monthly
  const basicSalary = 150000;
  const hra = 30000; // 20% of basic
  const da = 20000;
  const ta = 15000;
  const medicalAllowance = 10000;
  const otherAllowances = 5000;
  
  const grossSalary = basicSalary + hra + da + ta + medicalAllowance + otherAllowances; // Rs 230,000
  
  // Deductions
  const pf = basicSalary * 0.12; // 12% of basic = Rs 18,000
  const esi = 0;
  const professionalTax = 200;
  
  // Calculate TDS based on annual income
  // Annual: Rs 230,000 × 12 = Rs 2,760,000
  // Falls in slab: Rs 2,200,001 - Rs 3,200,000
  // Tax = Rs 116,000 + 23% of (Rs 2,760,000 - Rs 2,200,000)
  // Tax = Rs 116,000 + 23% of Rs 560,000 = Rs 116,000 + Rs 128,800 = Rs 244,800/year
  const annualIncome = grossSalary * 12;
  const annualTax = 116000 + ((annualIncome - 2200000) * 0.23);
  const monthlyTax = annualTax / 12; // Rs 20,400
  
  const totalDeductions = pf + esi + professionalTax + monthlyTax;
  const netSalary = grossSalary - totalDeductions;

  await prisma.salary.create({
    data: {
      employeeId: employee.id,
      basicSalary,
      hra,
      da,
      ta,
      medicalAllowance,
      otherAllowances,
      grossSalary,
      pf,
      esi,
      professionalTax,
      tds: monthlyTax,
      otherDeductions: 0,
      netSalary,
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  console.log('✅ Dummy employee created successfully!\n');
  console.log('📋 Employee Details:');
  console.log(`   Name: Ahmed Khan`);
  console.log(`   Employee Code: EMP-002`);
  console.log(`   Email: ahmed.khan@company.com`);
  console.log(`   Password: password123`);
  console.log(`   Department: ${department.name}`);
  console.log(`   Designation: ${designation.name}`);
  
  console.log('\n💰 Salary Breakdown:');
  console.log(`   Basic Salary: Rs ${basicSalary.toLocaleString()}`);
  console.log(`   HRA: Rs ${hra.toLocaleString()}`);
  console.log(`   DA: Rs ${da.toLocaleString()}`);
  console.log(`   TA: Rs ${ta.toLocaleString()}`);
  console.log(`   Medical Allowance: Rs ${medicalAllowance.toLocaleString()}`);
  console.log(`   Other Allowances: Rs ${otherAllowances.toLocaleString()}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Gross Salary: Rs ${grossSalary.toLocaleString()}/month`);
  
  console.log('\n📉 Deductions:');
  console.log(`   PF (12%): Rs ${Math.round(pf).toLocaleString()}`);
  console.log(`   Professional Tax: Rs ${professionalTax.toLocaleString()}`);
  console.log(`   TDS (Annual Rs ${Math.round(annualTax).toLocaleString()} ÷ 12): Rs ${Math.round(monthlyTax).toLocaleString()}`);
  console.log(`   ─────────────────────────────────`);
  console.log(`   Total Deductions: Rs ${Math.round(totalDeductions).toLocaleString()}/month`);
  
  console.log('\n💵 Net Salary: Rs ' + Math.round(netSalary).toLocaleString() + '/month');
  console.log('\n🔐 Login with: ahmed.khan@company.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
