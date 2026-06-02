import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: 'admin' }
  });
  console.log('Admin Details:', JSON.stringify(admin, null, 2));
}

main().finally(() => prisma.$disconnect());
