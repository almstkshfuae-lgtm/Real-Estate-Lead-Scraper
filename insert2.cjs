const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function insert() {
  await prisma.lead.createMany({
    data: [
      { name: 'Hussain Sajwani', company: 'DAMAC Properties', role: 'Chairman', location: 'Dubai, UAE', status: 'NEW', source: 'adgm', rawData: '{}', confidence: 95, tier: 'TIER_1' },
      { name: 'Mohamed Alabbar', company: 'Emaar Properties', role: 'Founder & Chairman', location: 'Dubai, UAE', status: 'NEW', source: 'adgm', rawData: '{}', confidence: 95, tier: 'TIER_1' },
      { name: 'PNC Menon', company: 'Sobha Realty', role: 'Founder & Chairman', location: 'Dubai, UAE', status: 'NEW', source: 'adgm', rawData: '{}', confidence: 95, tier: 'TIER_1' }
    ]
  });
  console.log('Leads inserted successfully');
}
insert().catch(console.error).finally(() => prisma.$disconnect());
