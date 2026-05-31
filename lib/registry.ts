import prisma from "./prisma";

export async function fetchAdgmCompanies(licenseType?: string) {
  // In a real Playwright script, this would navigate to ADGM public register and extract names
  // 7C.1: Playwright script for ADGM public register
  console.log("Mocking ADGM extraction...", licenseType);
  return [
    { name: "Alpha Investment Partners Ltd", category: "Financial Services" },
    { name: "Global Wealth Strategies ADGM", category: "Wealth Management" }
  ];
}

export async function fetchDifcCompanies() {
  // 7C.2: Playwright script for DIFC public register
  console.log("Mocking DIFC extraction...");
  return [
    { name: "Nexus Capital Holdings DIFC", category: "Private Equity" }
  ];
}

export async function fetchDedCompanies() {
  // 7C.3: Playwright script for DED license portal
  console.log("Mocking DED extraction...");
  return [
    { name: "Al Fares General Trading LLC", category: "Commercial" }
  ];
}

// 7C.4: Send company names to Gemini API for enrichment
export async function enrichCompanyData(companies: any[], source: string, agentId: string, scrapeRunId: string) {
  let savedCount = 0;
  
  for (const company of companies) {
    // Mocking Gemini enrichment
    // In reality, we would send company.name to the Gemini API to guess role/signals
    const enrichedLead = {
      name: "Managing Director", // Unknown person, focus on title
      company: company.name,
      role: "Director / Owner",
      source: source,
      tier: 2,
      location: source.includes("ADGM") ? "Abu Dhabi" : "Dubai",
      score: 55,
      signals: JSON.stringify(["Public Registry", company.category]),
      propertyPref: JSON.stringify({ type: "commercial" }),
      status: "new",
      agentId,
      scrapeRunId,
    };

    // 7C.5: Store enriched company leads in MySQL
    await prisma.lead.create({
      data: enrichedLead
    });
    savedCount++;
  }

  return savedCount;
}

export async function runRegistryScrapes(agentId: string, scrapeRunId: string) {
  let totalSaved = 0;

  const adgm = await fetchAdgmCompanies();
  totalSaved += await enrichCompanyData(adgm, "ADGM Registry", agentId, scrapeRunId);

  const difc = await fetchDifcCompanies();
  totalSaved += await enrichCompanyData(difc, "DIFC Registry", agentId, scrapeRunId);

  const ded = await fetchDedCompanies();
  totalSaved += await enrichCompanyData(ded, "DED License Portal", agentId, scrapeRunId);

  return totalSaved;
}
