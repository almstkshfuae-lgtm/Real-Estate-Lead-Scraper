import { SearchCriteria } from "./types";
import prisma from "./prisma";
import { getSecret } from "./secrets";

const ACTOR_ID = "tamer_almstkshf/Real-Estate-Lead-Scraper";

export async function triggerApifyScrape(criteria: SearchCriteria): Promise<string> {
  const APIFY_API_TOKEN = await getSecret("apifyToken");

  if (!APIFY_API_TOKEN) {
    throw new Error("Missing Apify API Token in settings or environment");
  }

  const response = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(criteria),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Apify run failed to start: ${err}`);
  }

  const data = await response.json();
  return data.data.id; // Returns the Apify Run ID
}

export async function getApifyRunResults(runId: string): Promise<any[]> {
  const APIFY_API_TOKEN = await getSecret("apifyToken");

  if (!APIFY_API_TOKEN) {
    throw new Error("Missing APIFY_API_TOKEN in environment variables");
  }

  // 1. Wait for run to finish (in a real app, this would be better handled by a webhook or cron polling, but for simplicity here we assume the cron polls it)
  const runResponse = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
  );

  if (!runResponse.ok) {
    throw new Error(`Failed to fetch run status for ${runId}`);
  }

  const runData = await runResponse.json();
  if (runData.data.status !== "SUCCEEDED") {
    if (runData.data.status === "FAILED" || runData.data.status === "ABORTED" || runData.data.status === "TIMED-OUT") {
      throw new Error(`Apify run failed with status: ${runData.data.status}`);
    }
    // If still running, return null to indicate polling should continue later
    return [];
  }

  // 2. Fetch dataset items
  const datasetId = runData.data.defaultDatasetId;
  const datasetResponse = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch dataset for run ${runId}`);
  }

  return await datasetResponse.json();
}

// Map raw Apify output to Prisma Lead schema
export function normalizeApifyLead(raw: any, agentId: string, scrapeRunId: string) {
  // Try to determine a mock tier based on budget
  const budget = raw.price || raw.budget || 0;
  let tier = 3;
  if (budget > 5000000) tier = 1;
  else if (budget > 2000000) tier = 2;

  // Determine signals
  const signals: string[] = [];
  if (budget > 5000000) signals.push("High Net Worth");
  if (raw.propertyType === "villa") signals.push("Villa Buyer");
  if (raw.isOffPlan) signals.push("Off-Plan Investor");

  return {
    name: raw.name || raw.agentName || "Unknown Contact",
    company: raw.agencyName || raw.company || "Unknown Agency",
    role: raw.role || "Buyer/Tenant",
    source: raw.portal || "Property Portal",
    tier: tier,
    phone: raw.phone || raw.mobile || null,
    email: raw.email || null,
    location: raw.location || raw.area || "Dubai",
    score: raw.score || Math.floor(Math.random() * 40) + 40, // Base score
    signals: signals,
    propertyPref: {
      type: raw.propertyType || "apartment",
      beds: raw.bedrooms || null,
    },
    budgetMin: budget ? budget * 0.9 : null,
    budgetMax: budget ? budget * 1.1 : null,
    relocated: !!raw.newToDubai,
    rentalFlag: raw.listingType === "rent" || raw.isRental,
    status: "new",
    notes: raw.description || null,
    agentId,
    scrapeRunId,
  };
}

// Sync leads to database
export async function syncLeadsToDb(rawLeads: any[], agentId: string, scrapeRunId: string) {
  let savedCount = 0;

  // Import dynamically or at top level to avoid circular dependencies if any
  const { mlAdjustScore } = await import('./ml/lead-model');

  for (const raw of rawLeads) {
    const normalized = normalizeApifyLead(raw, agentId, scrapeRunId);

    // Apply ML score adjustment based on learned weights
    normalized.score = await mlAdjustScore(normalized, normalized.score);

    // Deduplicate by phone or email
    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          { phone: normalized.phone || "___dummy___" },
          { email: normalized.email || "___dummy___" },
        ],
      },
    });

    if (!existing && (normalized.phone || normalized.email)) {
      await prisma.lead.create({
        data: normalized,
      });
      savedCount++;
    }
  }

  return savedCount;
}
