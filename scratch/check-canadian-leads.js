import prisma from '../lib/prisma.ts';
async function main() {
    const leads = await prisma.lead.findMany({
        where: {
            location: {
                in: ["Toronto", "Québec", "Quebec", "Vancouver", "Ottawa", "Edmonton", "Montreal"]
            }
        }
    });
    console.log(`Found ${leads.length} Canadian city leads:`);
    for (const lead of leads) {
        console.log(`- Name: ${lead.name}, Location: ${lead.location}, Coords: lat: ${lead.latitude}, lng: ${lead.longitude}`);
    }
    await prisma.$disconnect();
}
main().catch(console.error);
