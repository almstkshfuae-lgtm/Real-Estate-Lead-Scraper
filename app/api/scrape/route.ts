import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { extractHNWILeads, extractLeadsFromText, enrichLeadWithAI, generatePersonaAnalysis } from "@/lib/ai";
import { SearchCriteria } from "@/lib/types";
import { getScraperClient } from "@/lib/scraper-client";
import { getEnvVar } from "@/lib/env";
import { put } from "@vercel/blob";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";

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

    const { sources, criteria } = await request.json();

    const DEFAULT_SCRAPE_SOURCES = [
      'alforsan',
      'adec',
      'rotary',
      'whatson',
      'artsclub',
      'dhabianequi',
      'alhabtoor',
    ];

    const requestedSources = Array.isArray(sources) && sources.length > 0 ? sources : DEFAULT_SCRAPE_SOURCES;

    if (!requestedSources || requestedSources.length === 0) {
      return NextResponse.json({ error: 'sources array required' }, { status: 400 });
    }

    // Create a ScrapeRun record
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        triggeredBy: session.id,
        sources: JSON.stringify(requestedSources),
        criteria: JSON.stringify(criteria || {}),
        status: "PROCESSING",
      }
    });

    // Fire and forget pipeline
    runHNWIScrapePipeline(session.id, scrapeRun.id, requestedSources, criteria).catch(console.error);

    return NextResponse.json({ 
      message: 'HNWI lead scraping started', 
      runId: scrapeRun.id,
      sources: requestedSources
    });
  } catch (error: any) {
    console.error("Scrape initiation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Main HNWI Scraping Pipeline
 * 1. Calls Playwright service to scrape HNWI sources
 * 2. Extracts structured lead data using AI
 * 3. Enriches leads with scoring and signals
 * 4. Stores in database
 */
async function runHNWIScrapePipeline(
  agentId: string, 
  runId: string, 
  sourcesToScrape: string[], 
  criteria?: any
) {
  let totalLeadsFound = 0;
  const logs: any[] = [];
  const scraperServiceUrl = getEnvVar('SCRAPER_SERVICE_URL') || 'http://localhost:3002';
  const scraperSecret = getEnvVar('SCRAPER_SECRET') || 'scraper_secret_alpha_bravo';

  try {
    logs.push({ 
      step: "HNWI Pipeline Initialization", 
      status: "START", 
      time: new Date().toISOString(),
      sources: sourcesToScrape 
    });

    // Step 1: Call Playwright microservice to scrape HNWI sources
    logs.push({ 
      step: "Browser Scraping - HNWI Sources", 
      status: "START", 
      time: new Date().toISOString(),
      targetSources: sourcesToScrape
    });

    const scraperClient = await getScraperClient();
    const scraperResults: any[] = [];

    for (const sourceKey of sourcesToScrape) {
      try {
        const sourceResult = await scraperClient.scrapeSourceSync(sourceKey);
        scraperResults.push(sourceResult);
        logs.push({
          step: "Browser Scraping - HNWI Sources",
          status: "SUCCESS",
          source: sourceKey,
          pageCount: sourceResult.pagesScraped,
          contentLength: sourceResult.contentLength,
          time: new Date().toISOString()
        });
      } catch (error: any) {
        console.error(`Scrape failed for ${sourceKey}:`, error);
        logs.push({
          step: "Browser Scraping - HNWI Sources",
          status: "FAILED",
          source: sourceKey,
          error: error.message,
          time: new Date().toISOString()
        });
      }
    }

    logs.push({ 
      step: "Browser Scraping - HNWI Sources", 
      status: "COMPLETED", 
      count: scraperResults.length,
      time: new Date().toISOString()
    });

    // Step 2: AI Lead Extraction
    logs.push({ 
      step: "AI Lead Extraction", 
      status: "START", 
      time: new Date().toISOString()
    });

    let extractedLeads: any[] = [];

    for (const scrapedData of scraperResults) {
      try {
        const foundLeads = await extractHNWILeads(scrapedData, criteria);
        extractedLeads.push(...foundLeads);
        logs.push({
          step: "AI Lead Extraction",
          status: "SUCCESS",
          source: scrapedData.name,
          leadsExtracted: foundLeads.length,
          time: new Date().toISOString()
        });
      } catch (error: any) {
        console.error(`AI extraction failed for source ${scrapedData.name}:`, error);
        logs.push({
          step: "AI Lead Extraction",
          status: "FAILED",
          source: scrapedData.name,
          error: error.message,
          time: new Date().toISOString()
        });
      }
    }

    // Step 3: Enrich leads and store in database with strict deduplication
    for (const lead of extractedLeads) {
      try {
        const enrichedLead = await enrichLeadWithAI(lead);
        const persona = await generatePersonaAnalysis(enrichedLead);

        await prisma.lead.upsert({
          where: {
            name_company_source: {
              name: enrichedLead.name,
              company: enrichedLead.company,
              source: enrichedLead.source || "HNWI Sources"
            }
          },
          update: {
            nameAr: enrichedLead.nameAr || null,
            companyAr: enrichedLead.companyAr || null,
            role: enrichedLead.role,
            roleAr: enrichedLead.roleAr || null,
            tier: enrichedLead.tier || 2,
            phone: enrichedLead.phone || null,
            email: enrichedLead.email || null,
            location: enrichedLead.location || "Abu Dhabi",
            score: enrichedLead.score || 50,
            signals: JSON.stringify(enrichedLead.signals || []),
            budgetMin: enrichedLead.budgetMin ?? null,
            budgetMax: enrichedLead.budgetMax ?? null,
            relocated: enrichedLead.relocated ?? false,
            propertyPref: JSON.stringify(enrichedLead.propertyPref || {}),
            persona,
            agentId: agentId,
            scrapeRunId: runId
          },
          create: {
            name: enrichedLead.name,
            nameAr: enrichedLead.nameAr || null,
            company: enrichedLead.company,
            companyAr: enrichedLead.companyAr || null,
            role: enrichedLead.role,
            roleAr: enrichedLead.roleAr || null,
            source: enrichedLead.source || "HNWI Sources",
            sourceType: enrichedLead.sourceType || "Unknown",
            tier: enrichedLead.tier || 2,
            phone: enrichedLead.phone || null,
            email: enrichedLead.email || null,
            location: enrichedLead.location || "Abu Dhabi",
            score: enrichedLead.score || 50,
            signals: JSON.stringify(enrichedLead.signals || []),
            budgetMin: enrichedLead.budgetMin ?? null,
            budgetMax: enrichedLead.budgetMax ?? null,
            relocated: enrichedLead.relocated ?? false,
            propertyPref: JSON.stringify(enrichedLead.propertyPref || {}),
            agentId: agentId,
            scrapeRunId: runId,
            persona
          }
        });

        totalLeadsFound++;
      } catch (err: any) {
        console.error("Error processing lead:", err);
        logs.push({
          step: "Lead Processing",
          status: "ERROR",
          error: err.message,
          time: new Date().toISOString()
        });
      }
    }

    logs.push({ 
      step: "AI Lead Extraction & Enrichment", 
      status: "COMPLETED", 
      count: totalLeadsFound,
      time: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Pipeline error:", err);
    logs.push({ 
      step: "Pipeline Execution", 
      status: "FAILED", 
      error: err.message, 
      time: new Date().toISOString() 
    });
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

  // Update ScrapeRun with completion status
  await prisma.scrapeRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      leadsFound: totalLeadsFound,
      logUrl: logUrl,
      completedAt: new Date(),
    } as any
  });

  const tierOneCount = await prisma.lead.count({
    where: {
      scrapeRunId: runId,
      agentId,
      tier: 1,
    }
  });

  await notifyNewEliteLeads(agentId, tierOneCount, runId);
  await notifyScrapeCompletion(agentId, totalLeadsFound, runId);

  console.log(`✅ HNWI Pipeline completed: ${totalLeadsFound} leads found and processed`);
}
