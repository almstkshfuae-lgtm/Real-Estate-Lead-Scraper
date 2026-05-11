const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL
    }
  }
});

async function reset() {
  const hash = await bcrypt.hash('admin123', 10);
  await prisma.user.updateMany({
    where: { email: 'admin@brilliance.ae' },
    data: { passwordHash: hash }
  });
  console.log('Password reset to admin123');
}

reset().finally(() => prisma.$disconnect());
