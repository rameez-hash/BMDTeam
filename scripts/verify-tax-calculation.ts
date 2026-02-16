/**
 * Verification script to test tax calculations with official FY 2025-2026 slabs
 * Run with: npx tsx scripts/verify-tax-calculation.ts
 */

import { calculateTax } from '../lib/utils';

// Official Pakistan Income Tax Slabs for FY 2025-2026 (ANNUAL BASIS)
const taxSlabs2026 = [
  { minIncome: 0, maxIncome: 600000, taxRate: 0 }, // Up to Rs. 600,000
  { minIncome: 600000, maxIncome: 1200000, taxRate: 1 }, // Rs. 600,001-1,200,000
  { minIncome: 1200000, maxIncome: 2200000, taxRate: 11 }, // Rs. 1,200,001-2,200,000  
  { minIncome: 2200000, maxIncome: 3200000, taxRate: 23 }, // Rs. 2,200,001-3,200,000
  { minIncome: 3200000, maxIncome: 4100000, taxRate: 30 }, // Rs. 3,200,001-4,100,000
  { minIncome: 4100000, maxIncome: null, taxRate: 35 }, // Above Rs. 4,100,000
];

// Test cases - Calculate from official annual tax amounts
// Annual Tax = Base Tax + (Rate × Amount Exceeding Threshold)
const testCases = [
  { monthlyIncome: 50000, annualIncome: 600000, expectedTax: 0 }, // 0
  { monthlyIncome: 100000, annualIncome: 1200000, expectedTax: 500 }, // 6000/12
  { monthlyIncome: 150000, annualIncome: 1800000, expectedTax: 6000 }, // 6000 + (600000 × 11%)/12 = 72000/12
  { monthlyIncome: 200000, annualIncome: 2400000, expectedTax: 13500 }, // 6000 + (1200000 × 11%)/12 = 162000/12
  { monthlyIncome: 225000, annualIncome: 2700000, expectedTax: 19250 }, // 116000 + (500000 × 23%)/12 = 231000/12
  { monthlyIncome: 250000, annualIncome: 3000000, expectedTax: 25000 }, // 116000 + (800000 × 23%)/12 = 300000/12
  { monthlyIncome: 300000, annualIncome: 3600000, expectedTax: 38833.33 }, // 346000 + (400000 × 30%)/12 = 466000/12
  { monthlyIncome: 350000, annualIncome: 4200000, expectedTax: 54250 }, // 616000 + (100000 × 35%)/12 = 651000/12
  { monthlyIncome: 400000, annualIncome: 4800000, expectedTax: 71750 }, // 616000 + (700000 × 35%)/12 = 861000/12
  { monthlyIncome: 450000, annualIncome: 5400000, expectedTax: 89250 }, // 616000 + (1300000 × 35%)/12 = 1071000/12
  { monthlyIncome: 500000, annualIncome: 6000000, expectedTax: 106750 }, // 616000 + (1900000 × 35%)/12 = 1281000/12
];

console.log('🧪 Testing Pakistan Income Tax Calculations for FY 2026\n');
console.log('Tax slabs are ANNUAL. For monthly: salary × 12 → calculate tax → ÷ 12');
console.log('=' .repeat(90));

let allPassed = true;

for (const test of testCases) {
  const calculatedTax = calculateTax(test.monthlyIncome, taxSlabs2026);
  const difference = Math.abs(calculatedTax - test.expectedTax);
  const tolerance = 2; // Allow 2 Rs difference due to rounding
  
  const passed = difference <= tolerance;
  allPassed = allPassed && passed;
  
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} | Monthly: Rs ${test.monthlyIncome.toLocaleString().padEnd(10)} | Annual: Rs ${test.annualIncome.toLocaleString().padEnd(12)} | Expected: Rs ${Math.round(test.expectedTax).toLocaleString().padEnd(10)} | Calculated: Rs ${Math.round(calculatedTax).toLocaleString().padEnd(10)} | Diff: Rs ${difference.toFixed(2)}`);
}

console.log('=' .repeat(90));
console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed'}\n`);

// Additional breakdown example
console.log('\n📊 Detailed Breakdown for Rs 300,000 Monthly (Rs 3,600,000 Annual):');
console.log('-'.repeat(80));
let monthlyIncome = 300000;
let annualIncome = monthlyIncome * 12;
let remainingIncome = annualIncome;
let totalTax = 0;

for (const slab of taxSlabs2026) {
  if (remainingIncome <= 0) break;
  
  const slabMax = slab.maxIncome || Infinity;
  const slabRange = slabMax - slab.minIncome;
  const taxableInThisSlab = Math.min(remainingIncome, slabRange);
  const taxForSlab = taxableInThisSlab * (slab.taxRate / 100);
  
  totalTax += taxForSlab;
  remainingIncome -= taxableInThisSlab;
  
  console.log(
    `Rs ${slab.minIncome.toLocaleString().padEnd(11)} - Rs ${(slab.maxIncome?.toLocaleString() || 'Above').padEnd(11)} | ` +
    `${slab.taxRate.toString().padEnd(5)}% | ` +
    `Taxable: Rs ${taxableInThisSlab.toLocaleString().padEnd(11)} | ` +
    `Tax: Rs ${Math.round(taxForSlab).toLocaleString()}`
  );
}

console.log('-'.repeat(80));
console.log(`Total Annual Tax: Rs ${Math.round(totalTax).toLocaleString()}`);
console.log(`Monthly Tax (Annual ÷ 12): Rs ${Math.round(totalTax / 12).toLocaleString()}`);
console.log(`Annual Net Salary: Rs ${(annualIncome - Math.round(totalTax)).toLocaleString()}`);
console.log(`Monthly Net Salary: Rs ${Math.round((annualIncome - totalTax) / 12).toLocaleString()}\n`);

process.exit(allPassed ? 0 : 1);
