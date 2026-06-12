import prisma from "../lib/prisma";
import { getAreasInBounds } from "../lib/areas";

async function main() {
  console.log("Starting Full-Text Search (FTS) OR query test...");

  const searchString = '"Dubai Marina"';

  try {
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          { location: { search: searchString } },
          { locationAr: { search: searchString } }
        ]
      },
      select: {
        id: true,
        name: true,
        location: true,
        locationAr: true
      },
      take: 5
    });

    console.log(`Successfully found ${leads.length} leads matching FTS query:`);
    leads.forEach(l => {
      console.log(`- Lead ID: ${l.id}, Name: ${l.name}, Location: ${l.location}, LocationAr: ${l.locationAr}`);
    });
  } catch (error) {
    console.error("FTS Query execution failed:", error);
    process.exit(1);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
