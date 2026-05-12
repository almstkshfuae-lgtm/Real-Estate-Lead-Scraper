import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { triggerApifyScrape } from "@/lib/apify";
import { processNewsToLeads } from "@/lib/serpapi";
import { runRegistryScrapes } from "@/lib/registry";
import { processApolloLeads } from "@/lib/apollo";
import { SearchCriteria } from "@/lib/types";
import { put } from "@vercel/blob";

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
        sources: ["Apify", "SerpAPI", "Registries", "Apollo"],
        criteria: criteria,
        status: "PROCESSING",
      }
    });

    // Fire and forget pipeline
    runScrapePipeline(session.id, scrapeRun.id, criteria).catch(console.error);

    return NextResponse.json({ message: 'Scrape job started successfully', runId: scrapeRun.id });
  } catch (error: any) {
    console.error("Scrape trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runScrapePipeline(agentId: string, runId: string, criteria: SearchCriteria) {
  let totalLeadsFound = 0;
  const logs: any[] = [];

  try {
    logs.push({ step: "Apify", status: "START", time: new Date().toISOString() });
    const apifyRunId = await triggerApifyScrape(criteria);
    logs.push({ step: "Apify", status: "TRIGGERED", runId: apifyRunId, time: new Date().toISOString() });
  } catch (err: any) {
    logs.push({ step: "Apify", status: "FAILED", error: err.message, time: new Date().toISOString() });
  }

  try {
    logs.push({ step: "SerpAPI", status: "START", time: new Date().toISOString() });
    const queries = ["UAE investor relocate", "DIFC company launch", "Abu Dhabi family office"];
    const saved = await processNewsToLeads(queries, agentId, runId);
    totalLeadsFound += saved;
    logs.push({ step: "SerpAPI", status: "COMPLETED", saved, time: new Date().toISOString() });
  } catch (err: any) {
    logs.push({ step: "SerpAPI", status: "FAILED", error: err.message, time: new Date().toISOString() });
  }

  try {
    logs.push({ step: "Registry", status: "START", time: new Date().toISOString() });
    const saved = await runRegistryScrapes(agentId, runId);
    totalLeadsFound += saved;
    logs.push({ step: "Registry", status: "COMPLETED", saved, time: new Date().toISOString() });
  } catch (err: any) {
    logs.push({ step: "Registry", status: "FAILED", error: err.message, time: new Date().toISOString() });
  }

  try {
    logs.push({ step: "Apollo", status: "START", time: new Date().toISOString() });
    const saved = await processApolloLeads(agentId, runId);
    totalLeadsFound += saved;
    logs.push({ step: "Apollo", status: "COMPLETED", saved, time: new Date().toISOString() });
  } catch (err: any) {
    logs.push({ step: "Apollo", status: "FAILED", error: err.message, time: new Date().toISOString() });
  }

  // Upload logs to Vercel Blob
  let logUrl = null;
  try {
    const logFileName = `scrape-logs/${runId}.json`;
    const blob = await put(logFileName, JSON.stringify(logs, null, 2), {
      access: 'public',
      contentType: 'application/json',
    });
    logUrl = blob.url;
  } catch (err) {
    console.error("Failed to upload logs to Vercel Blob:", err);
  }

  await prisma.scrapeRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      leadsFound: totalLeadsFound,
      logUrl: logUrl,
      completedAt: new Date(),
    } as any
  });
}
