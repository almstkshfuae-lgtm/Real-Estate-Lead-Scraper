import prisma from "./prisma";

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || "";

export async function searchNewsForSignals(query: string) {
  if (!SERPAPI_API_KEY) {
    throw new Error("Missing SERPAPI_API_KEY in environment variables");
  }

  // E.g., "UAE investor relocate", "DIFC company launch"
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbm=nws&api_key=${SERPAPI_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to fetch news from SerpAPI");
  }

  const data = await res.json();
  return data.news_results || [];
}

export function extractLeadFromArticle(article: any) {
  // In a real implementation, we'd send the article text/snippet to Claude API here (Task 7B.4)
  // For now, we mock the extraction to satisfy the database schema
  const mockName = "Executive " + Math.floor(Math.random() * 1000);
  const mockCompany = article.source || "News Organization";

  return {
    name: mockName,
    company: mockCompany,
    role: "Director",
    source: article.source || "News Outlet",
    tier: 2, // Default
    location: "UAE",
    score: 60,
    signals: ["News Mention", "Business Expansion"],
    propertyPref: { type: "apartment" },
    status: "new",
    notes: `Found via SerpAPI query in article: ${article.title} - ${article.link}`,
  };
}

export async function processNewsToLeads(queries: string[], agentId: string, scrapeRunId: string) {
  let savedCount = 0;

  for (const query of queries) {
    try {
      const articles = await searchNewsForSignals(query);

      for (const article of articles.slice(0, 5)) { // process top 5 per query
        const newLead = extractLeadFromArticle(article);

        // Apply ML score adjustment based on learned weights
        const { mlAdjustScore } = await import('./ml/lead-model');
        newLead.score = await mlAdjustScore(newLead, newLead.score);

        // Save to DB (Task 7B.6 deduplication logic could be added here, but name/company matching is fuzzy)
        await prisma.lead.create({
          data: {
            ...newLead,
            agentId,
            scrapeRunId,
          }
        });
        savedCount++;
      }
    } catch (err) {
      console.error(`Failed to process news for query "${query}":`, err);
    }
  }

  return savedCount;
}
