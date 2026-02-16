const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_T67xNBWUmewk@ep-flat-smoke-aik5vkfj-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function main() {
  console.log('=== USERS TABLE ===');
  const users = await prisma.user.findMany({
    select: { id: true, employeeId: true, email: true, role: true }
  });
  console.table(users);

  console.log('\n=== EMPLOYEES TABLE ===');
  const employees = await prisma.employee.findMany({
    select: { id: true, userId: true, employeeCode: true, firstName: true, lastName: true, designation: true, departmentId: true }
  });
  console.table(employees);
}

main().catch(console.error).finally(() => prisma.$disconnect());
