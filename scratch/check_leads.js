import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      name: true,
      source: true,
      agentId: true,
      location: true,
      createdAt: true
    }
  });
  console.log('Total leads remaining in database:', leads.length);
  const sources = {};
  leads.forEach(l => {
    sources[l.source] = (sources[l.source] || 0) + 1;
  });
  console.log('Remaining leads by source:', JSON.stringify(sources, null, 2));
  await prisma.$disconnect();
}
main();
