import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    include: { employee: { select: { email: true, firstName: true, lastName: true } } }
  });
  
  if (!admin) {
    console.log('No admin found');
    return;
  }

  console.log('Admin:', admin.employee?.firstName, admin.employee?.lastName);
  console.log('Email:', admin.email);
  
  // Reset password to admin123
  const newPassword = 'admin123';
  const hashed = await bcrypt.hash(newPassword, 12);
  
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashed }
  });
  
  console.log('Password reset to:', newPassword);
}

main().finally(() => prisma.$disconnect());
