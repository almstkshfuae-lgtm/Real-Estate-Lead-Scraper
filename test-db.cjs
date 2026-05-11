const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  const count = await prisma.user.count();
  console.log(`User count: ${count}`);
  const users = await prisma.user.findMany();
  console.log('Users:', users);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
