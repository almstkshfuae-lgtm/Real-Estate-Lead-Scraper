/**
 * POST /api/scrape-runs/cleanup
 *
 * Zombie run recovery — marks any PROCESSING or PENDING ScrapeRun
 * older than 35 minutes as FAILED.
 *
 * The scraper-service's zombie watchdog kills jobs at 25 minutes and
 * sends a `isFailedSignal` webhook. This cleanup catches runs where
 * the webhook itself failed (network drop, Railway restart, etc.).
 *
 * Protected by CRON_SECRET bearer token — intended for Vercel Cron.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const ZOMBIE_AGE_MINUTES = 35;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - ZOMBIE_AGE_MINUTES * 60 * 1000);

    const zombieRuns = await prisma.scrapeRun.findMany({
      where: {
        status: { in: ["PROCESSING", "PENDING"] },
        startedAt: { lt: cutoff },
      },
      select: { id: true, status: true, startedAt: true },
    });

    if (zombieRuns.length === 0) {
      return NextResponse.json({
        cleaned: 0,
        message: "No zombie runs found",
      });
    }

    const zombieIds = zombieRuns.map((r) => r.id);

    const result = await prisma.scrapeRun.updateMany({
      where: { id: { in: zombieIds } },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });

    console.info(
      `[Cleanup] Marked ${result.count} zombie runs as FAILED:`,
      zombieIds
    );

    return NextResponse.json({
      cleaned: result.count,
      ids: zombieIds,
      cutoffMinutes: ZOMBIE_AGE_MINUTES,
    });
  } catch (error: any) {
    console.error("[Cleanup] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
