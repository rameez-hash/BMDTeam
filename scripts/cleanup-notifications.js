const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find and remove duplicate payroll notifications (keep only the latest one per user+message)
  const payrollNotifs = await p.notification.findMany({
    where: { type: 'PAYROLL_GENERATED' },
    orderBy: { createdAt: 'desc' },
  });

  // Group by userId + message
  const groups = {};
  for (const n of payrollNotifs) {
    const key = `${n.userId}||${n.message}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  }

  let deletedCount = 0;
  for (const [key, notifs] of Object.entries(groups)) {
    if (notifs.length > 1) {
      // Keep the first (most recent), delete the rest
      const toDelete = notifs.slice(1).map(n => n.id);
      console.log(`Removing ${toDelete.length} duplicates for: ${key.split('||')[1]}`);
      await p.notification.deleteMany({ where: { id: { in: toDelete } } });
      deletedCount += toDelete.length;
    }
  }

  console.log(`\nCleaned up ${deletedCount} duplicate payroll notifications`);

  // Show final counts
  const remaining = await p.notification.count();
  const byType = await p.notification.groupBy({
    by: ['type'],
    _count: { id: true },
  });
  console.log(`\nTotal remaining: ${remaining}`);
  for (const g of byType) {
    console.log(`  ${g.type}: ${g._count.id}`);
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
