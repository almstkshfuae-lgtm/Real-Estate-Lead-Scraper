import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getScraperClient } from "@/lib/scraper-client";
import { runRegistryScrapes } from "@/lib/registry";
import { put } from "@vercel/blob";

// Default admin agent ID to assign leads to if triggered by cron
const SYSTEM_AGENT_ID = "cm0x2abc1234567890abcdef"; 

import { getSessionWithDBVerify } from "@/lib/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  let isAuthorized = false;
  
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isAuthorized = true;
  } else {
    try {
      const session = await getSessionWithDBVerify();
      if (session && session.role.toUpperCase() === 'ADMIN') {
        isAuthorized = true;
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!isAuthorized) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const scrapeRun = await prisma.scrapeRun.create({
      data: {
        triggeredBy: "cron",
        sources: JSON.stringify(["InternalScraper", "Registry"]),
        criteria: JSON.stringify({ type: "daily_sync" }),
        status: "PENDING",
      }
    });

    let totalLeadsFound = 0;
    const logs: any[] = [];

    let asyncScraperTriggered = false;
    // 3. Trigger internal scraper service
    try {
      const scraperClient = await getScraperClient();
      logs.push({ step: "InternalScraper", status: "START", time: new Date().toISOString() });
      let origin = new URL(request.url).origin;
      if (origin.includes('localhost')) {
        origin = origin.replace('localhost', '127.0.0.1');
      }
      const webhookUrl = `${origin}/api/scrape/webhook`;
      const response = await scraperClient.scrapeMultipleSources([
        "abudhabi-elites", 
        "abu-dhabi-business-directories", 
        "abu-dhabi-news-signals",
        "adgm",
        "difc"
      ], webhookUrl, scrapeRun.id);
      logs.push({ step: "InternalScraper", status: "TRIGGERED", response, time: new Date().toISOString() });
      asyncScraperTriggered = true;
    } catch (err: any) {
      const maskedError = err.message ? err.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(err);
      logs.push({ step: "InternalScraper", status: "FAILED", error: maskedError, time: new Date().toISOString() });
    }

    // 4. Trigger registry scrapes
    try {
      logs.push({ step: "Registry", status: "START", time: new Date().toISOString() });
      const saved = await runRegistryScrapes(SYSTEM_AGENT_ID, scrapeRun.id);
      totalLeadsFound += saved;
      logs.push({ step: "Registry", status: "COMPLETED", saved, time: new Date().toISOString() });
    } catch (err: any) {
      const maskedError = err.message ? err.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(err);
      logs.push({ step: "Registry", status: "FAILED", error: maskedError, time: new Date().toISOString() });
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

    if (asyncScraperTriggered) {
      // If async scraper triggered, let the webhook update to COMPLETED/FAILED.
      // Update the logUrl here.
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          logUrl: logUrl,
        }
      });
    } else {
      // If async scraper failed to trigger, complete it here with registry count
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          status: totalLeadsFound > 0 ? "COMPLETED" : "FAILED",
          leadsFound: totalLeadsFound,
          logUrl: logUrl,
          completedAt: new Date(),
        } as any
      });
    }

    return NextResponse.json({ success: true, leadsFound: totalLeadsFound });
  } catch (error: any) {
    const errorMsg = error.message ? error.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(error);
    console.error("Cron scrape error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
