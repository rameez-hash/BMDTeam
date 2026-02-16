import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slabs = await prisma.taxSlab.findMany({
    orderBy: { minIncome: 'asc' }
  });
  
  console.log('\n📊 Tax Slabs in Database:\n');
  slabs.forEach(slab => {
    console.log(`${slab.name}`);
    console.log(`  Min Income: Rs ${slab.minIncome.toLocaleString()}`);
    console.log(`  Max Income: ${slab.maxIncome ? 'Rs ' + slab.maxIncome.toLocaleString() : 'No Limit'}`);
    console.log(`  Fixed Tax: Rs ${slab.fixedTax.toLocaleString()}`);
    console.log(`  Tax Rate: ${slab.taxRate}%`);
    console.log('');
  });

  // Test tax calculation
  console.log('\n🧮 Tax Calculation Examples:\n');
  
  const testCases = [
    { monthly: 40000, desc: 'Rs 40,000/month (4.8 Lakh/year)' },
    { monthly: 60000, desc: 'Rs 60,000/month (7.2 Lakh/year)' },
    { monthly: 100000, desc: 'Rs 1,00,000/month (12 Lakh/year)' },
    { monthly: 150000, desc: 'Rs 1,50,000/month (18 Lakh/year)' },
    { monthly: 250000, desc: 'Rs 2,50,000/month (30 Lakh/year)' },
  ];

  for (const test of testCases) {
    const annualIncome = test.monthly * 12;
    
    // Find applicable slab
    const sortedSlabs = [...slabs].sort((a, b) => b.minIncome - a.minIncome);
    const applicableSlab = sortedSlabs.find(slab => annualIncome > slab.minIncome);
    
    if (!applicableSlab || applicableSlab.taxRate === 0) {
      console.log(`${test.desc}`);
      console.log(`  Annual Income: Rs ${annualIncome.toLocaleString()}`);
      console.log(`  Tax: Rs 0 (No tax)\n`);
      continue;
    }
    
    const exceedingAmount = annualIncome - applicableSlab.minIncome;
    const fixedTax = applicableSlab.fixedTax || 0;
    const variableTax = exceedingAmount * (applicableSlab.taxRate / 100);
    const totalAnnualTax = fixedTax + variableTax;
    const monthlyTax = Math.round((totalAnnualTax / 12) * 100) / 100;
    
    console.log(`${test.desc}`);
    console.log(`  Annual Income: Rs ${annualIncome.toLocaleString()}`);
    console.log(`  Applicable Slab: ${applicableSlab.name}`);
    console.log(`  Exceeding Amount: Rs ${exceedingAmount.toLocaleString()}`);
    console.log(`  Fixed Tax: Rs ${fixedTax.toLocaleString()}`);
    console.log(`  Variable Tax: ${exceedingAmount.toLocaleString()} × ${applicableSlab.taxRate}% = Rs ${variableTax.toLocaleString()}`);
    console.log(`  Total Annual Tax: Rs ${totalAnnualTax.toLocaleString()}`);
    console.log(`  Monthly Tax: Rs ${monthlyTax.toLocaleString()}\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
