import prisma from "./prisma";
import { getSecret } from "./secrets";

export async function searchNewsForSignals(query: string) {
  const SERPAPI_API_KEY = await getSecret("serpApiKey");

  if (!SERPAPI_API_KEY) {
    throw new Error("Missing SerpAPI Key in settings or environment");
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

import { extractLeadsFromText, enrichLeadWithAI } from "./ai";

export async function processNewsToLeads(queries: string[], agentId: string, scrapeRunId: string) {
  let savedCount = 0;

  for (const query of queries) {
    try {
      const articles = await searchNewsForSignals(query);
      
      // Combine article titles and snippets for context
      const context = articles.slice(0, 10).map((a: any) => `${a.title}: ${a.snippet}`).join("\n---\n");
      const extractedLeads = await extractLeadsFromText(context);

      for (const leadData of extractedLeads) {
        // Find the article that match this lead (roughly) to get the source
        const matchingArticle = articles.find((a: any) => 
          a.title.includes(leadData.company) || a.snippet.includes(leadData.name)
        ) || articles[0];

        const baseLead = {
          ...leadData,
          source: matchingArticle?.source || "News Outlet",
          location: "UAE",
          propertyPref: { type: "apartment" },
          status: "new",
          notes: `Extracted from news query: ${query}. Mentioned in: ${matchingArticle?.title}`,
        };

        const enriched = await enrichLeadWithAI(baseLead);
        
        // Apply ML score adjustment
        const { mlAdjustScore } = await import('./ml/lead-model');
        enriched.score = await mlAdjustScore(enriched, enriched.score || 60);

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
      console.error(`Failed to process news for query "${query}":`, err);
    }
  }

  return savedCount;
}
