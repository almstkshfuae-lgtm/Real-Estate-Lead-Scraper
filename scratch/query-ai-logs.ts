import prisma from '../lib/prisma.ts';

async function main() {
  const logs = await prisma.aiUsageLog.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
  });
  console.log('RECORDS:', JSON.stringify(logs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
