import prisma from '../lib/prisma.ts';

async function main() {
  const leads = await prisma.lead.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(leads, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
