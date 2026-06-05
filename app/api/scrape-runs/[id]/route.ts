/**
 * GET /api/scrape-runs/[id]
 *
 * Returns the status and summary of a single ScrapeRun.
 * Designed for efficient frontend polling — returns only the fields
 * the progress banner needs, avoiding full lead payload transfer.
 *
 * Used by the `useScrapeRunStatus` hook which polls every 5 seconds
 * until the run reaches a terminal state (COMPLETED / FAILED).
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!id || typeof id !== "string" || id.length < 10) {
      return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
    }

    const run = await prisma.scrapeRun.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        leadsFound: true,
        startedAt: true,
        completedAt: true,
        sources: true,
        triggeredBy: true,
      },
    });

    if (!run) {
      return NextResponse.json({ error: "ScrapeRun not found" }, { status: 404 });
    }

    // Non-admins can only view their own runs
    const isAdmin = session.role.toUpperCase() === "ADMIN";
    if (!isAdmin && run.triggeredBy !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      {
        run: {
          id: run.id,
          status: run.status,
          leadsFound: run.leadsFound,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          sources: run.sources,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("[scrape-runs/[id]] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
