import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, isAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHostAdmin = isAdmin(session.role);
    const runs = await prisma.scrapeRun.findMany({
      where: isHostAdmin ? {} : { triggeredBy: session.id },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    // Dynamically calculate active lead counts for the retrieved runs
    const runIds = runs.map(r => r.id);

    // scrapeRunId no longer exists on Lead — query via LeadScrapeRun join table
    const rawAssociations = await prisma.leadScrapeRun.findMany({
      where: {
        scrapeRunId: { in: runIds },
        lead: {
          deletedAt: null,
          ...(isHostAdmin ? {} : { agentId: session.id })
        }
      },
      select: { scrapeRunId: true }
    });

    const countsMap = rawAssociations.reduce((acc, curr) => {
      acc[curr.scrapeRunId] = (acc[curr.scrapeRunId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const parsedRuns = runs.map((run) => {
      let parsedCriteria = run.criteria;

      try {
        if (typeof run.criteria === 'string') {
          parsedCriteria = JSON.parse(run.criteria);
        }
      } catch (e) {
        // ignore
      }

      let parsedSources: any[] = [];

      try {
        if (typeof run.sources === 'string') {
          if (run.sources.trim().startsWith('[')) {
            parsedSources = JSON.parse(run.sources);
          } else if (run.sources.trim() !== '') {
            parsedSources = run.sources.split(',').map(s => s.trim());
          }
        } else if (Array.isArray(run.sources)) {
          parsedSources = run.sources;
        }
      } catch (e) {
        if (typeof run.sources === 'string') {
          parsedSources = run.sources.split(',').map(s => s.trim());
        }
      }

      const isActive = run.status === 'PENDING' || run.status === 'PROCESSING';
      const leadsFound = countsMap[run.id] !== undefined
        ? countsMap[run.id]
        : (isActive ? run.leadsFound : 0);

      return {
        ...run,
        leadsFound,
        criteria: parsedCriteria,
        sources: parsedSources,
      };
    });

    return NextResponse.json({ runs: parsedRuns });
  } catch (error: any) {
    console.error("Fetch ScrapeRuns Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
