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
    const finalCriteria = criteria || {};

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
      'ded',
      'gazette',
      'arabianbusiness',
      'propertymonitor',
      'abudhabichamber',
      'canadian-doctors',
      'cpsa',
      'ahus-canada',
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
        criteria: JSON.stringify(finalCriteria),
        status: "PENDING",
      }
    });

    const scraperClient = await getScraperClient();
    let origin = request.nextUrl.origin;
    if (origin.includes('localhost')) {
      origin = origin.replace('localhost', '127.0.0.1');
    }
    const webhookUrl = `${origin}/api/scrape/webhook`;

    console.log(`[Scraper] Dispatching async scrape run ${scrapeRun.id} to microservice. Webhook: ${webhookUrl}`);

    try {
      // Trigger the microservice scraper asynchronously to prevent serverless execution timeout (15s limit)
      await scraperClient.scrapeMultipleSources(requestedSources, webhookUrl, scrapeRun.id, finalCriteria);
    } catch (triggerError: any) {
      console.error("Failed to trigger scraper service, marking run as FAILED:", triggerError.message);
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: { status: "FAILED" }
      });

      if (role === 'AGENT') {
        return NextResponse.json({
          message: 'HNWI lead scraping started (fallback mode)',
          runId: scrapeRun.id,
          sources: requestedSources
        });
      }

      return NextResponse.json({ error: "Scraper service is unavailable or failed: " + triggerError.message }, { status: 503 });
    }

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

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithDBVerify();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scraperClient = await getScraperClient();
    const sources = await scraperClient.getAvailableSources();

    return NextResponse.json({ sources });
  } catch (error: any) {
    console.error("Get sources error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
