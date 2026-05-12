import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { triggerApifyScrape } from "@/lib/apify";
import { processNewsToLeads } from "@/lib/serpapi";
import { runRegistryScrapes } from "@/lib/registry";
import { processApolloLeads } from "@/lib/apollo";
import { SearchCriteria } from "@/lib/types";
import { put } from "@vercel/blob";

// Default admin agent ID to assign leads to if triggered by cron
const SYSTEM_AGENT_ID = "cm0x2abc1234567890abcdef"; 

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        triggeredBy: "cron",
        sources: ["Apify", "SerpAPI", "Registry", "Apollo"],
        criteria: { type: "daily_sync" },
        status: "PROCESSING",
      }
    });

    let totalLeadsFound = 0;
    const logs: any[] = [];

    // 3. Trigger 7A (Apify)
    try {
      logs.push({ step: "Apify", status: "START", time: new Date().toISOString() });
      const criteria: SearchCriteria = {
        propertyTypes: ["apartment", "villa"],
        budgetMin: 2000000,
        recentlyRelocated: false,
        excludeRental: false,
        emirates: ["Dubai"],
        signals: [],
        tierMin: 2,
      };
      const runId = await triggerApifyScrape(criteria);
      logs.push({ step: "Apify", status: "TRIGGERED", runId, time: new Date().toISOString() });
    } catch (err: any) {
      logs.push({ step: "Apify", status: "FAILED", error: err.message, time: new Date().toISOString() });
    }

    // 4. Trigger 7B (SerpAPI)
    try {
      logs.push({ step: "SerpAPI", status: "START", time: new Date().toISOString() });
      const queries = ["UAE investor relocate", "DIFC company launch", "Abu Dhabi family office"];
      const saved = await processNewsToLeads(queries, SYSTEM_AGENT_ID, scrapeRun.id);
      totalLeadsFound += saved;
      logs.push({ step: "SerpAPI", status: "COMPLETED", saved, time: new Date().toISOString() });
    } catch (err: any) {
      logs.push({ step: "SerpAPI", status: "FAILED", error: err.message, time: new Date().toISOString() });
    }

    // 5. Trigger 7C (Registries)
    try {
      logs.push({ step: "Registry", status: "START", time: new Date().toISOString() });
      const saved = await runRegistryScrapes(SYSTEM_AGENT_ID, scrapeRun.id);
      totalLeadsFound += saved;
      logs.push({ step: "Registry", status: "COMPLETED", saved, time: new Date().toISOString() });
    } catch (err: any) {
      logs.push({ step: "Registry", status: "FAILED", error: err.message, time: new Date().toISOString() });
    }

    // 6. Trigger 7F (Apollo)
    try {
      logs.push({ step: "Apollo", status: "START", time: new Date().toISOString() });
      const saved = await processApolloLeads(SYSTEM_AGENT_ID, scrapeRun.id);
      totalLeadsFound += saved;
      logs.push({ step: "Apollo", status: "COMPLETED", saved, time: new Date().toISOString() });
    } catch (err: any) {
      logs.push({ step: "Apollo", status: "FAILED", error: err.message, time: new Date().toISOString() });
    }

    // Upload logs to Vercel Blob
    let logUrl = null;
    try {
      const logFileName = `scrape-logs/${scrapeRun.id}.json`;
      const blob = await put(logFileName, JSON.stringify(logs, null, 2), {
        access: 'public',
        contentType: 'application/json',
      });
      logUrl = blob.url;
    } catch (err) {
      console.error("Failed to upload logs to Vercel Blob:", err);
    }

    await prisma.scrapeRun.update({
      where: { id: scrapeRun.id },
      data: {
        status: "COMPLETED",
        leadsFound: totalLeadsFound,
        logUrl: logUrl,
        completedAt: new Date(),
      } as any
    });

    return NextResponse.json({ success: true, leadsFound: totalLeadsFound });
  } catch (error: any) {
    console.error("Cron scrape error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
