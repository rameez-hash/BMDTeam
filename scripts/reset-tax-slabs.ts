import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up old tax slabs...\n');
  
  // Delete all existing tax slabs
  const deleted = await prisma.taxSlab.deleteMany({});
  console.log(`Deleted ${deleted.count} old tax slabs`);
  
  // Create fresh Pakistan 2025-26 tax slabs
  const currentYear = new Date().getFullYear();
  
  const slabs = [
    { id: `tax-0-${currentYear}`, name: 'No Tax (Up to 6 Lakh)', minIncome: 0, maxIncome: 600000, fixedTax: 0, taxRate: 0, year: currentYear },
    { id: `tax-1-${currentYear}`, name: '1% Slab (6-12 Lakh)', minIncome: 600000, maxIncome: 1200000, fixedTax: 0, taxRate: 1, year: currentYear },
    { id: `tax-11-${currentYear}`, name: '11% Slab (12-22 Lakh)', minIncome: 1200000, maxIncome: 2200000, fixedTax: 6000, taxRate: 11, year: currentYear },
    { id: `tax-23-${currentYear}`, name: '23% Slab (22-32 Lakh)', minIncome: 2200000, maxIncome: 3200000, fixedTax: 116000, taxRate: 23, year: currentYear },
    { id: `tax-30-${currentYear}`, name: '30% Slab (32-41 Lakh)', minIncome: 3200000, maxIncome: 4100000, fixedTax: 346000, taxRate: 30, year: currentYear },
    { id: `tax-35-${currentYear}`, name: '35% Slab (Above 41 Lakh)', minIncome: 4100000, maxIncome: null, fixedTax: 616000, taxRate: 35, year: currentYear },
  ];
  
  for (const slab of slabs) {
    await prisma.taxSlab.create({ data: slab });
    console.log(`✅ Created: ${slab.name}`);
  }
  
  console.log('\n🎉 Pakistan 2025-26 tax slabs created successfully!');
  
  // Verify
  const allSlabs = await prisma.taxSlab.findMany({ orderBy: { minIncome: 'asc' } });
  console.log('\n📊 Final Tax Slabs:\n');
  allSlabs.forEach(s => {
    console.log(`${s.name}: Rs ${s.minIncome.toLocaleString()} - ${s.maxIncome ? 'Rs ' + s.maxIncome.toLocaleString() : 'No Limit'} | Fixed: Rs ${s.fixedTax.toLocaleString()} | Rate: ${s.taxRate}%`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
