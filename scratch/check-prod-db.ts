import { PrismaClient } from '@prisma/client';

const prodDatabaseUrl = "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway?connection_limit=10&socket_timeout=60000";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl
    }
  }
});

async function main() {
  console.log('Querying PRODUCTION database users...');
  try {
    const users = await prisma.user.findMany({});
    console.log('Production Users found:', JSON.stringify(users, null, 2));
  } catch (err: any) {
    console.error('Failed to query Production database:', err.message || err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
