import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      employee: {
        select: { email: true, firstName: true, lastName: true }
      }
    }
  });
  
  for (const u of users) {
    const mismatch = u.email !== u.employee?.email ? ' *** MISMATCH ***' : '';
    console.log(`${u.role} | User.email: ${u.email} | Employee.email: ${u.employee?.email} | ${u.employee?.firstName} ${u.employee?.lastName}${mismatch}`);
  }
}

main().finally(() => prisma.$disconnect());
