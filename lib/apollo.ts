import prisma from "./prisma";
import { enrichLeadWithAI } from "./ai";
import { getSecret } from "./secrets";

export async function searchPeople(filters: any) {
  const APOLLO_API_KEY = await getSecret("apolloApiKey");
  
  if (!APOLLO_API_KEY) {
    throw new Error("Missing Apollo API Key in settings or environment");
  }

  const url = "https://api.apollo.io/api/v1/mixed_people/api_search";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "accept": "application/json",
      "X-Api-Key": APOLLO_API_KEY,
    },
    body: JSON.stringify({
      ...filters,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Apollo API request failed: ${err}`);
  }

  const data = await res.json();
  return data.people || [];
}

export async function processApolloLeads(agentId: string, scrapeRunId: string) {
  // Default filters for UAE real estate prospecting
  const filters = {
    person_locations: ["Dubai", "Abu Dhabi", "United Arab Emirates"],
    person_titles: ["CEO", "Founder", "Managing Director", "Owner", "Investor", "Partner"],
    page: 1,
    per_page: 10, // Start with small batches
  };

  const people = await searchPeople(filters);
  let savedCount = 0;

  for (const person of people) {
    try {
      const baseLead = {
        name: `${person.first_name} ${person.last_name_obfuscated || ""}`.trim(),
        email: person.has_email ? "Verified in Apollo" : "N/A",
        phone: person.has_direct_phone === "Yes" ? "Direct Dial in Apollo" : "N/A",
        company: person.organization?.name || "N/A",
        location: person.has_city ? "Dubai, UAE" : "UAE",
        role: person.title || "Executive",
        source: "Apollo Prospecting",
        status: "new",
        propertyPref: { type: "investment" },
        notes: `Apollo Prospecting - ID: ${person.id}. Seniority matched.`,
      };

      const enriched = await enrichLeadWithAI(baseLead);
      
      // Apply ML score adjustment
      const { mlAdjustScore } = await import('./ml/lead-model');
      enriched.score = await mlAdjustScore(enriched, enriched.score || 70);

      // Deduplicate by name + company if email/phone are masked
      const existing = await prisma.lead.findFirst({
        where: {
          name: enriched.name,
          company: enriched.company,
        }
      });

      if (!existing) {
        await prisma.lead.create({
          data: {
            ...enriched,
            agentId,
            scrapeRunId,
          }
        });
        savedCount++;
      }
    } catch (err) {
      console.error(`Failed to process Apollo lead ${person.id}:`, err);
    }
  }

  return savedCount;
}
