import prisma from '../lib/prisma.ts';
import { normalizeLocation, resolveCoords } from '../lib/ai.ts';

async function main() {
  console.log("Starting backfill/re-normalization of coordinates for all leads...");
  const leads = await prisma.lead.findMany();

  console.log(`Found ${leads.length} leads in database.`);

  let updatedCount = 0;
  for (const lead of leads) {
    let sourceLoc = lead.location;
    
    // Recovery logic for leads previously mistakenly normalized to Abu Dhabi
    if (lead.location === "Abu Dhabi") {
      const lowerCompany = (lead.company || "").toLowerCase();
      const lowerPersona = (lead.persona || "").toLowerCase();
      const lowerSource = (lead.source || "").toLowerCase();
      if (lowerCompany.includes("dubai") || lowerPersona.includes("dubai") || lowerSource.includes("dubai")) {
        sourceLoc = "Dubai";
      }
    }

    const normalizedLoc = normalizeLocation(sourceLoc);
    const coords = resolveCoords(normalizedLoc);

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        location: normalizedLoc,
        latitude: coords.lat,
        longitude: coords.lng
      }
    });
    updatedCount++;
  }

  console.log(`Successfully updated/normalized ${updatedCount} leads.`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
