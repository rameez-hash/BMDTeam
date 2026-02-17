import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all users where User.email != Employee.email and sync them
  const users = await prisma.user.findMany({
    include: { employee: { select: { id: true, email: true } } }
  });
  
  for (const u of users) {
    if (u.employee && u.email !== u.employee.email) {
      console.log(`Syncing: User.email ${u.email} -> ${u.employee.email}`);
      await prisma.user.update({
        where: { id: u.id },
        data: { email: u.employee.email }
      });
      console.log('Done!');
    }
  }
  console.log('All emails synced.');
}

main().finally(() => prisma.$disconnect());
