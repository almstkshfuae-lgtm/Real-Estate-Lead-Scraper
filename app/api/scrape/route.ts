import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/auth";
import prisma from "../../../lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow both Admins and Agents to trigger new scrapes
    const role = session.role.toUpperCase();
    if (role !== 'ADMIN' && role !== 'AGENT') {
      return NextResponse.json({ error: "Forbidden: Higher privileges required" }, { status: 403 });
    }

    const { criteria } = await request.json();

    if (!criteria) {
      return NextResponse.json({ error: 'Criteria required' }, { status: 400 });
    }

    const SCRAPER_URL = process.env.SCRAPER_SERVICE_URL || "http://localhost:3002";
    const SCRAPER_SECRET = process.env.SCRAPER_SECRET;

    // Create a ScrapeRun record first
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        triggeredBy: session.id,
        sources: ["Bayut", "Property Finder"],
        criteria: criteria,
        status: "PENDING",
      }
    });

    console.log(`Triggering scrape at ${SCRAPER_URL} for run ${scrapeRun.id}`);

    // Call the decoupled scraper service
    const scraperRes = await fetch(`${SCRAPER_URL}/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        scrapeRunId: scrapeRun.id,
        criteria,
        secret: SCRAPER_SECRET 
      }),
    }).catch(err => {
      console.error("Scraper service connection failed:", err.message);
      return null;
    });

    if (scraperRes && scraperRes.ok) {
      // Update status to processing if successfully sent
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: { status: "PROCESSING" }
      });
      return NextResponse.json({ message: 'Scrape job started successfully', runId: scrapeRun.id });
    } else {
      return NextResponse.json({ 
        message: 'Scrape request received',
        warning: 'Scraper worker currently offline, job queued for later processing.',
        runId: scrapeRun.id
      });
    }
  } catch (error: any) {
    console.error("Scrape trigger error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
