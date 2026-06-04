import prisma from '../lib/prisma';
import { generatePersonaAnalysis } from '../lib/ai';

async function main() {
  // Find a lead (preferably manual entry or seeded lead)
  const lead = await prisma.lead.findFirst({
    where: {
      OR: [
        { name: "Manual Entry" },
        { company: "Manual Entry" },
        { persona: null }
      ]
    }
  }) || await prisma.lead.findFirst();

  if (!lead) {
    console.error("No leads found in database!");
    return;
  }

  console.log("Found lead:", {
    id: lead.id,
    name: lead.name,
    company: lead.company,
    role: lead.role,
    persona: lead.persona
  });

  console.log("\nGenerating English persona...");
  const englishPersona = await generatePersonaAnalysis(lead, "en");
  console.log("English Persona Result:\n", englishPersona);

  console.log("\nGenerating Arabic persona...");
  const arabicPersona = await generatePersonaAnalysis(lead, "ar");
  console.log("Arabic Persona Result:\n", arabicPersona);
}

main().catch((error) => {
  console.error("Error in test-persona:", error);
  process.exit(1);
});
