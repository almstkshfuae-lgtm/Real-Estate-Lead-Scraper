import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { triggerApifyScrape } from "@/lib/apify";
import { processNewsToLeads } from "@/lib/serpapi";
import { runRegistryScrapes } from "@/lib/registry";
import { SearchCriteria } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.role.toUpperCase();
    if (role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.json({ error: "Forbidden: Higher privileges required" }, { status: 403 });
    }

    const { criteria } = await request.json();

    if (!criteria) {
      return NextResponse.json({ error: 'Criteria required' }, { status: 400 });
    }

    // Create a ScrapeRun record first
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        triggeredBy: session.id,
        sources: ["Apify", "SerpAPI", "Registries"],
        criteria: criteria,
        status: "PROCESSING",
      }
    });

    // Fire and forget pipeline
    runScrapePipeline(session.id, scrapeRun.id).catch(console.error);

    return NextResponse.json({ message: 'Scrape job started successfully', runId: scrapeRun.id });
  } catch (error: any) {
    console.error("Scrape trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runScrapePipeline(agentId: string, runId: string) {
  let totalLeadsFound = 0;

  try {
    const criteria: SearchCriteria = {
      propertyTypes: ["apartment", "villa"],
      budgetMin: 2000000,
      recentlyRelocated: false,
      excludeRental: false,
      emirates: ["Dubai"],
      signals: [],
      tierMin: 2,
    };

    const apifyRunId = await triggerApifyScrape(criteria);
    console.log(`Apify Scrape Triggered with runId: ${apifyRunId}`);
  } catch (err: any) {
    console.error("Apify scrape failed:", err.message);
  }

  try {
    const queries = ["UAE investor relocate", "DIFC company launch", "Abu Dhabi family office"];
    const saved = await processNewsToLeads(queries, agentId, runId);
    totalLeadsFound += saved;
  } catch (err: any) {
    console.error("SerpAPI extraction failed:", err.message);
  }

  try {
    const saved = await runRegistryScrapes(agentId, runId);
    totalLeadsFound += saved;
  } catch (err: any) {
    console.error("Registry extraction failed:", err.message);
  }

  await prisma.scrapeRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      leadsFound: totalLeadsFound,
      completedAt: new Date(),
    }
  });
}
