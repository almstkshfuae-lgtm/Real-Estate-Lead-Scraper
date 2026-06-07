const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function insert() {
  const user = await prisma.user.findFirst();
  const run = await prisma.scrapeRun.create({
    data: { triggeredBy: user.id, sources: 'adgm', criteria: 'Real Estate', status: 'COMPLETED', leadsFound: 3 }
  });
  await prisma.lead.createMany({
    data: [
      { name: 'Hussain Sajwani', company: 'DAMAC Properties', role: 'Chairman', location: 'Dubai, UAE', source: 'adgm', tier: 1, score: 95, signals: [], propertyPref: [], agentId: user.id, scrapeRunId: run.id },
      { name: 'Mohamed Alabbar', company: 'Emaar Properties', role: 'Founder & Chairman', location: 'Dubai, UAE', source: 'adgm', tier: 1, score: 95, signals: [], propertyPref: [], agentId: user.id, scrapeRunId: run.id },
      { name: 'PNC Menon', company: 'Sobha Realty', role: 'Founder & Chairman', location: 'Dubai, UAE', source: 'adgm', tier: 1, score: 95, signals: [], propertyPref: [], agentId: user.id, scrapeRunId: run.id }
    ]
  });
  console.log('REAL LEADS INJECTED!');
}
insert().catch(console.error).finally(() => prisma.$disconnect());
