import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching recent AI Usage Logs...');
  const aiLogs = await prisma.aiUsageLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('--- Recent AI Usage Logs ---');
  console.log(JSON.stringify(aiLogs, null, 2));

  console.log('\nFetching recent Audit Logs...');
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log('--- Recent Audit Logs ---');
  console.log(JSON.stringify(auditLogs, null, 2));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
