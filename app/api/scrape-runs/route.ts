import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHostAdmin = session.role.toUpperCase() === 'ADMIN';
    const runs = await prisma.scrapeRun.findMany({
      where: isHostAdmin ? {} : { triggeredBy: session.id },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

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

      return {
        ...run,
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
