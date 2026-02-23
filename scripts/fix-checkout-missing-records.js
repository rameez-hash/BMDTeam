// Fix 3 records: Feb 20 (Faraz Najam, Nabba Yawar) and Feb 19 (Saba Rajar) - checkout missing
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find records with checkIn but no checkOut for Feb 19 and Feb 20
  const records = await prisma.attendance.findMany({
    where: {
      checkIn: { not: null },
      checkOut: null,
      date: {
        gte: new Date('2026-02-19'),
        lte: new Date('2026-02-20'),
      },
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeCode: true } },
    },
  });

  console.log(`Found ${records.length} records with missing checkout:`);
  for (const r of records) {
    const dateStr = r.date.toISOString().slice(0, 10);
    console.log(`  - ${r.employee.firstName} ${r.employee.lastName} (${r.employee.employeeCode}) on ${dateStr}, checkIn: ${r.checkIn?.toISOString()}`);
  }

  if (records.length === 0) {
    console.log('No records found. Exiting.');
    return;
  }

  // Mark them as checkoutMissing with workHours=0
  for (const r of records) {
    await prisma.attendance.update({
      where: { id: r.id },
      data: {
        checkoutMissing: true,
        workHours: 0,
        overtime: 0,
        notes: `Checkout missed — employee did not check out. Contact HR to correct.`,
      },
    });
    console.log(`  ✓ Marked ${r.employee.firstName} ${r.employee.lastName} (${r.date.toISOString().slice(0, 10)}) as checkoutMissing`);
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
