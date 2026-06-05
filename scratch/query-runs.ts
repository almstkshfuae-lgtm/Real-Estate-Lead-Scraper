import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const runs = await prisma.scrapeRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(runs, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
