const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_T67xNBWUmewk@ep-flat-smoke-aik5vkfj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, employeeId: true, email: true, role: true, isActive: true }
  });
  console.log('=== USERS TABLE ===');
  console.table(users);

  const roles = await prisma.$queryRaw`SELECT unnest(enum_range(NULL::"Role"))::text as role`;
  console.log('\n=== ROLE ENUM VALUES ===');
  console.table(roles);
}

main().catch(console.error).finally(() => prisma.$disconnect());
