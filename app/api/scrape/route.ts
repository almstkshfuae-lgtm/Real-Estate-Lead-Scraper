import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithDBVerify } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getScraperClient } from "@/lib/scraper-client";

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithDBVerify();
    
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
      'adgm',
      'difc',
      'gazette',
      'arabianbusiness',
      'propertymonitor',
      'abudhabichamber',
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
        status: "PENDING",
      }
    });

    const scraperClient = await getScraperClient();
    const origin = request.nextUrl.origin;
    const webhookUrl = `${origin}/api/scrape/webhook`;

    console.log(`[Scraper] Dispatching async scrape run ${scrapeRun.id} to microservice. Webhook: ${webhookUrl}`);
    
    // Trigger the microservice scraper asynchronously to prevent serverless execution timeout (15s limit)
    await scraperClient.scrapeMultipleSources(requestedSources, webhookUrl, scrapeRun.id);

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
