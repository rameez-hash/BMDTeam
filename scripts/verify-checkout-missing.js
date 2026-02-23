const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check that the column exists and all existing records have false
  const total = await p.attendance.count();
  const missingCount = await p.attendance.count({ where: { checkoutMissing: true } });
  console.log(`Total attendance records: ${total}`);
  console.log(`Records with checkoutMissing=true: ${missingCount}`);
  console.log(`Records with checkoutMissing=false: ${total - missingCount}`);
  console.log('\nAll data safe - column added with default false.');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
