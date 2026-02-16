const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check total notification count
  const total = await p.notification.count();
  console.log('=== Notification System Check ===');
  console.log('Total notifications in DB:', total);

  // Get recent notifications
  const notifications = await p.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
  });

  console.log('\n=== Recent 15 Notifications ===');
  for (const n of notifications) {
    console.log({
      title: n.title,
      message: n.message.slice(0, 80),
      type: n.type,
      module: n.module,
      link: n.link,
      isRead: n.isRead,
      userId: n.userId,
      created: n.createdAt.toISOString().slice(0, 16),
    });
  }

  // Check if userId references valid users
  const uniqueUserIds = [...new Set(notifications.map(n => n.userId))];
  console.log('\n=== User ID Validation ===');
  for (const uid of uniqueUserIds) {
    const user = await p.user.findUnique({ where: { id: uid }, select: { id: true, email: true, role: true } });
    console.log(`User ${uid}: ${user ? `${user.email} (${user.role})` : '*** NOT FOUND - ORPHAN ***'}`);
  }

  // Check unread counts per user
  const unreadByUser = await p.notification.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { isRead: false },
  });
  console.log('\n=== Unread Count Per User ===');
  for (const g of unreadByUser) {
    const user = await p.user.findUnique({ where: { id: g.userId }, select: { email: true } });
    console.log(`${user?.email || g.userId}: ${g._count.id} unread`);
  }

  // Check notification types distribution
  const byType = await p.notification.groupBy({
    by: ['type'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\n=== By Type ===');
  for (const g of byType) {
    console.log(`${g.type}: ${g._count.id}`);
  }

  // Check links are valid
  console.log('\n=== Link Check ===');
  const withLinks = notifications.filter(n => n.link);
  const withoutLinks = notifications.filter(n => !n.link);
  console.log(`With links: ${withLinks.length}, Without links: ${withoutLinks.length}`);
  const uniqueLinks = [...new Set(withLinks.map(n => n.link))];
  for (const link of uniqueLinks) {
    console.log(`  Link: ${link}`);
  }

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
