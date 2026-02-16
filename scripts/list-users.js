const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const users = await p.user.findMany({ select: { email: true, role: true, isActive: true } });
  users.forEach(u => console.log(u.email, u.role, u.isActive ? 'ACTIVE' : 'LOCKED'));
  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
