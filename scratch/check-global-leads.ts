import prisma from '../lib/prisma.ts';

async function main() {
  const leads = await prisma.lead.findMany();
  console.log(`Total leads: ${leads.length}`);

  const locations = new Map<string, number>();
  for (const lead of leads) {
    locations.set(lead.location, (locations.get(lead.location) || 0) + 1);
  }
  console.log("Leads by location:", Object.fromEntries(locations));

  const internationalLeads = leads.filter(lead => {
    const text = `${lead.location} ${lead.company} ${lead.persona || ""} ${lead.notes || ""}`.toLowerCase();
    return text.includes("canada") || text.includes("london") || text.includes("riyadh") || text.includes("uk") || text.includes("saudi") || text.includes("korea") || text.includes("germany") || text.includes("france") || text.includes("egypt");
  });

  console.log(`Found ${internationalLeads.length} leads containing global keywords:`);
  for (const lead of internationalLeads) {
    console.log(`- ID: ${lead.id}, Name: ${lead.name}, Location: ${lead.location}, Company: ${lead.company}`);
    console.log(`  Persona/Notes hint: ${lead.persona || lead.notes || "none"}`);
    console.log(`  Current coords: lat: ${lead.latitude}, lng: ${lead.longitude}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
