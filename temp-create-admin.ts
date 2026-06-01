import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

async function createAdmin() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@brilliance.ae' },
    update: {},
    create: {
      email: 'admin@brilliance.ae',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Super Admin',
      role: 'admin',
      language: 'en',
    },
  });
  console.log('Created admin:', admin.email);
  process.exit(0);
}

createAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
