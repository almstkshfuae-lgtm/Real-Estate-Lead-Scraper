/**
 * restore-user.cjs
 * Restores the admin user whose ID is stored in the current browser JWT.
 * Run: node restore-user.cjs
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL
    }
  }
});

async function restore() {
  // This is the exact cuid stored in the JWT that the browser is sending.
  // Using upsert so running this twice is safe.
  const TARGET_ID = 'cmpvk2pax0000429mv9ufyakx';
  const EMAIL = 'admin@brilliance.ae';
  const NAME = 'Admin';
  const ROLE = 'admin';
  const PASSWORD = 'admin123';

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { id: TARGET_ID },
    update: { email: EMAIL, name: NAME, role: ROLE, passwordHash },
    create: { id: TARGET_ID, email: EMAIL, name: NAME, role: ROLE, passwordHash }
  });

  console.log('\u2705 User restored:', { id: user.id, email: user.email, role: user.role });
  console.log('   Login with: ' + EMAIL + ' / ' + PASSWORD);
}

restore()
  .catch(e => { console.error('\u274c Failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
