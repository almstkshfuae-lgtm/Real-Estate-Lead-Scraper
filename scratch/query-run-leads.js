import prisma from '../lib/prisma.ts';

async function main() {
  const runId = 'cmq6ayfa80000okdg5ha8h0h2';
  const leads = await prisma.lead.findMany({
    where: { scrapeRunId: runId },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Found ${leads.length} leads for run ${runId}:`);
  console.log(JSON.stringify(leads, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
