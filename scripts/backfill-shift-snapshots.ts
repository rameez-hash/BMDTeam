/**
 * Backfill Shift Snapshots
 * 
 * This script fills in the shift snapshot fields (shiftName, shiftStartTime, etc.)
 * for all attendance records that have NULL values. It uses the employee's CURRENT
 * shift assignment to populate the snapshot.
 * 
 * Run: npx tsx scripts/backfill-shift-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding attendance records with missing shift snapshots...\n');

  // Get all attendance records that don't have a shift snapshot
  const records = await prisma.attendance.findMany({
    where: {
      shiftName: null,
      // Only backfill records that have a check-in (real records, not placeholders)
      checkIn: { not: null },
    },
    include: {
      employee: {
        include: {
          shift: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${records.length} records missing shift snapshots.\n`);

  if (records.length === 0) {
    console.log('✅ All records already have shift snapshots. Nothing to do!');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    const shift = record.employee?.shift;

    if (!shift) {
      console.log(`  ⚠ Skipping record ${record.id} (${record.date.toISOString().split('T')[0]}) — employee ${record.employee?.firstName || 'unknown'} has no shift assigned`);
      skipped++;
      continue;
    }

    await prisma.attendance.update({
      where: { id: record.id },
      data: {
        shiftName: shift.name,
        shiftStartTime: shift.startTime,
        shiftEndTime: shift.endTime,
        shiftBreakDuration: shift.breakDuration,
        shiftGraceTime: shift.graceTime,
        shiftStandardWorkHours: shift.standardWorkHours,
      },
    });

    updated++;
    const empName = `${record.employee?.firstName} ${record.employee?.lastName}`;
    const dateStr = record.date.toISOString().split('T')[0];
    console.log(`  ✅ ${empName} — ${dateStr} → ${shift.name} (${shift.startTime}-${shift.endTime})`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped} (no shift assigned)`);
  console.log(`   Total:   ${records.length}`);
  console.log(`\n✅ Backfill complete!`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
