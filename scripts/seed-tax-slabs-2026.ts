/**
 * Seed script to add Pakistan Income Tax Slabs for FY 2026
 * 
 * This script creates the revised tax slabs announced in Finance Act 2025-26
 * These are monthly-based tax brackets with progressive rates
 * 
 * Run with: npx tsx scripts/seed-tax-slabs-2026.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting tax slab seeding for FY 2026...');

  // Tax slabs for 2026 (ANNUAL basis - as per official Finance Act 2025-2026)
  // These are the official government tax brackets
  // The system will convert monthly salary to annual, calculate tax, then divide by 12
  //
  // Annual Income          | Tax Calculation
  // ----------------------|--------------------------------------------------
  // Up to Rs. 600,000     | 0%
  // Rs. 600,001-1,200,000 | 1% of amount exceeding Rs. 600,000
  // Rs. 1,200,001-2,200,000| Rs. 6,000 + 11% of amount exceeding Rs. 1,200,000
  // Rs. 2,200,001-3,200,000| Rs. 116,000 + 23% of amount exceeding Rs. 2,200,000
  // Rs. 3,200,001-4,100,000| Rs. 346,000 + 30% of amount exceeding Rs. 3,200,000
  // Above Rs. 4,100,000   | Rs. 616,000 + 35% of amount exceeding Rs. 4,100,000
  
  const taxSlabs2026 = [
    {
      name: 'Tax Free Slab',
      minIncome: 0,
      maxIncome: 600000, // Annual
      taxRate: 0,
      year: 2026,
    },
    {
      name: 'Basic Rate - 1%',
      minIncome: 600000,
      maxIncome: 1200000, // Annual
      taxRate: 1,
      year: 2026,
    },
    {
      name: 'Lower Middle Income - 11%',
      minIncome: 1200000,
      maxIncome: 2200000, // Annual
      taxRate: 11,
      year: 2026,
    },
    {
      name: 'Middle Income - 23%',
      minIncome: 2200000,
      maxIncome: 3200000, // Annual
      taxRate: 23,
      year: 2026,
    },
    {
      name: 'Higher Income - 30%',
      minIncome: 3200000,
      maxIncome: 4100000, // Annual
      taxRate: 30,
      year: 2026,
    },
    {
      name: 'Highest Income - 35%',
      minIncome: 4100000,
      maxIncome: null, // Above Rs. 4,100,000 annual
      taxRate: 35,
      year: 2026,
    },
  ];

  console.log('\n📊 Creating tax slabs for 2026...');

  // Delete existing 2026 slabs if any
  const deleted = await prisma.taxSlab.deleteMany({
    where: { year: 2026 },
  });
  
  if (deleted.count > 0) {
    console.log(`   ⚠️  Deleted ${deleted.count} existing 2026 tax slabs`);
  }

  // Create new slabs
  let created = 0;
  for (const slab of taxSlabs2026) {
    await prisma.taxSlab.create({
      data: slab,
    });
    created++;
    console.log(
      `   ✅ ${slab.name}: Rs ${slab.minIncome.toLocaleString()} - ${
        slab.maxIncome ? `Rs ${slab.maxIncome.toLocaleString()}` : 'Above'
      } (${slab.taxRate}%)`
    );
  }

  console.log(`\n✨ Successfully created ${created} tax slabs for FY 2026`);
  console.log('\n📝 Official Pakistan Income Tax Slabs FY 2025-2026 (ANNUAL BASIS):');
  console.log('   • Up to Rs 600,000: 0%');
  console.log('   • Rs 600,001 - Rs 1,200,000: Rs 0 + 1% of amount exceeding Rs 600,000');
  console.log('   • Rs 1,200,001 - Rs 2,200,000: Rs 6,000 + 11% of amount exceeding Rs 1,200,000');
  console.log('   • Rs 2,200,001 - Rs 3,200,000: Rs 116,000 + 23% of amount exceeding Rs 2,200,000');
  console.log('   • Rs 3,200,001 - Rs 4,100,000: Rs 346,000 + 30% of amount exceeding Rs 3,200,000');
  console.log('   • Above Rs 4,100,000: Rs 616,000 + 35% of amount exceeding Rs 4,100,000');
  
  console.log('\n📊 Tax Calculation Examples:');
  console.log('   • Annual: Rs 600,000 (Monthly: Rs 50,000) → Tax: Rs 0/year → Rs 0/month');
  console.log('   • Annual: Rs 1,200,000 (Monthly: Rs 100,000) → Tax: Rs 6,000/year → Rs 500/month');
  console.log('   • Annual: Rs 1,800,000 (Monthly: Rs 150,000) → Tax: Rs 72,000/year → Rs 6,000/month');
  console.log('   • Annual: Rs 2,400,000 (Monthly: Rs 200,000) → Tax: Rs 162,000/year → Rs 13,500/month');
  console.log('   • Annual: Rs 3,000,000 (Monthly: Rs 250,000) → Tax: Rs 300,000/year → Rs 25,000/month');
  
  console.log('\n💡 Note: Tax slabs are stored as ANNUAL amounts.');
  console.log('   For monthly payroll: Monthly salary × 12 = Annual, calculate tax, then ÷ 12.');
  console.log('   Previous payroll records remain unchanged (immutable snapshots).');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding tax slabs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
