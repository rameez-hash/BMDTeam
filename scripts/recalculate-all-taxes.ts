import { PrismaClient } from '@prisma/client';
import { calculateTax } from '../lib/utils';

const prisma = new PrismaClient();

async function recalculateAllTaxes() {
  try {
    console.log('🔄 Starting tax recalculation for all employees...\n');

    // Get active tax slabs
    const taxSlabs = await prisma.taxSlab.findMany({
      where: { isActive: true },
      orderBy: { minIncome: 'asc' }
    });

    if (taxSlabs.length === 0) {
      console.log('❌ No active tax slabs found. Please seed tax slabs first.');
      return;
    }

    console.log(`✅ Found ${taxSlabs.length} active tax slabs\n`);
    console.log('Tax Slabs:');
    taxSlabs.forEach(slab => {
      console.log(`  - Rs ${slab.minIncome.toLocaleString()} - ${slab.maxIncome ? 'Rs ' + slab.maxIncome.toLocaleString() : 'Above'}: ${slab.taxRate}%`);
    });
    console.log('');

    // Get all salaries
    const salaries = await prisma.salary.findMany({
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true
          }
        }
      }
    });

    console.log(`📊 Found ${salaries.length} salary records to update\n`);

    let updated = 0;
    let unchanged = 0;

    for (const salary of salaries) {
      const grossSalary = salary.basicSalary + salary.hra + salary.da + 
                         salary.ta + salary.medicalAllowance + salary.otherAllowances;

      // Calculate new TDS
      const newTds = calculateTax(grossSalary, taxSlabs);
      const oldTds = salary.tds;

      // Calculate new net salary
      const newNetSalary = grossSalary - salary.pf - salary.esi - 
                          salary.professionalTax - newTds - salary.otherDeductions;

      if (Math.abs(oldTds - newTds) > 0.01) {
        // Update salary record
        await prisma.salary.update({
          where: { id: salary.id },
          data: {
            tds: newTds,
            netSalary: newNetSalary,
            grossSalary: grossSalary
          }
        });

        console.log(`✅ ${salary.employee.firstName} ${salary.employee.lastName} (${salary.employee.employeeCode})`);
        console.log(`   Gross: Rs ${grossSalary.toLocaleString()}`);
        console.log(`   Old TDS: Rs ${oldTds.toLocaleString()} → New TDS: Rs ${newTds.toLocaleString()}`);
        console.log(`   Net Salary: Rs ${newNetSalary.toLocaleString()}\n`);
        updated++;
      } else {
        console.log(`⏭️  ${salary.employee.firstName} ${salary.employee.lastName} - No change needed`);
        unchanged++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Tax recalculation completed!');
    console.log(`   Updated: ${updated} records`);
    console.log(`   Unchanged: ${unchanged} records`);
    console.log(`   Total: ${salaries.length} records`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error recalculating taxes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

recalculateAllTaxes()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
