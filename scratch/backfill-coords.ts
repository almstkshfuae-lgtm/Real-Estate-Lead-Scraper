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
      const lowerNotes = (lead.notes || "").toLowerCase();
      
      const searchTerms = [
        "london", "canada", "toronto", "montreal", "vancouver", "ottawa", "edmonton", "quebec", "québec",
        "riyadh", "jeddah", "saudi", "kuwait", "qatar", "doha", "bahrain", "manama", "oman", "muscat",
        "egypt", "cairo", "lebanon", "beirut", "jordan", "amman", "india", "mumbai", "russia", "moscow",
        "china", "turkey", "istanbul", "pakistan", "dubai"
      ];

      for (const term of searchTerms) {
        if (lowerCompany.includes(term) || lowerPersona.includes(term) || lowerSource.includes(term) || lowerNotes.includes(term)) {
          // Capitalize first letter of term for presentation
          sourceLoc = term.charAt(0).toUpperCase() + term.slice(1);
          if (term === "québec") sourceLoc = "Québec";
          break;
        }
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
