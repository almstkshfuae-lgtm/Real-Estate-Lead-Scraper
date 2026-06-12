import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getScraperClient, getWebhookUrl } from "@/lib/scraper-client";
import { put } from "@vercel/blob";

import { getSessionWithDBVerify, isAdmin } from "@/lib/auth";
import { notifyScrapeRunUpdate } from "@/lib/scrape-events";

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  let isAuthorized = false;
  
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    isAuthorized = true;
  } else {
    try {
      const session = await getSessionWithDBVerify();
      if (session && isAdmin(session.role)) {
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
        sources: JSON.stringify(["InternalScraper", "Decoupled Registries"]),
        criteria: JSON.stringify({ type: "daily_sync" }),
        status: "PENDING",
      }
    });
    await notifyScrapeRunUpdate(scrapeRun.id);

    let totalLeadsFound = 0;
    const logs: any[] = [];

    let asyncScraperTriggered = false;
    // 3. Trigger internal scraper service for all sources including ADGM, DIFC, and DED registries
    try {
      const scraperClient = await getScraperClient();
      logs.push({ step: "InternalScraper", status: "START", time: new Date().toISOString() });
      const webhookUrl = getWebhookUrl(new URL(request.url).origin);
      const response = await scraperClient.scrapeMultipleSources([
        "abudhabi-elites", 
        "abu-dhabi-business-directories", 
        "abu-dhabi-news-signals",
        "adgm",
        "difc",
        "ded"
      ], webhookUrl, scrapeRun.id);
      logs.push({ step: "InternalScraper", status: "TRIGGERED", response, time: new Date().toISOString() });
      asyncScraperTriggered = true;
    } catch (err: any) {
      const maskedError = err.message ? err.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(err);
      logs.push({ step: "InternalScraper", status: "FAILED", error: maskedError, time: new Date().toISOString() });
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
      await notifyScrapeRunUpdate(scrapeRun.id);
    } else {
      // If async scraper failed to trigger, complete it here
      await prisma.scrapeRun.update({
        where: { id: scrapeRun.id },
        data: {
          status: "FAILED",
          leadsFound: 0,
          logUrl: logUrl,
          completedAt: new Date(),
        } as any
      });
      await notifyScrapeRunUpdate(scrapeRun.id);
    }

    return NextResponse.json({ success: true, leadsFound: totalLeadsFound });
  } catch (error: any) {
    const errorMsg = error.message ? error.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(error);
    console.error("Cron scrape error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
