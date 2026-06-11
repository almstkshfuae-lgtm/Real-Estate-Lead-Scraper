import { EventEmitter } from "events";
import prisma from "@/lib/prisma";

class ScrapeEventEmitter extends EventEmitter {}

// Global singleton to survive Next.js HMR in dev
const globalForEvents = global as unknown as {
  scrapeEvents?: ScrapeEventEmitter;
};

export const scrapeEvents = globalForEvents.scrapeEvents ?? new ScrapeEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.scrapeEvents = scrapeEvents;
}

/**
 * Fetch the latest run state and notify all active SSE listeners for this runId.
 */
export async function notifyScrapeRunUpdate(runId: string) {
  try {
    const run = await prisma.scrapeRun.findUnique({
      where: { id: runId },
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

    if (run) {
      let parsedSources = run.sources;
      try {
        if (typeof parsedSources === "string") {
          parsedSources = JSON.parse(parsedSources);
        }
      } catch (e) {}

      scrapeEvents.emit(`run:${runId}`, {
        id: run.id,
        status: run.status,
        leadsFound: run.leadsFound,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        sources: parsedSources,
      });
      console.log(`[ScrapeEvents] Emitted update for run ${runId}: status=${run.status}, leadsFound=${run.leadsFound}`);
    }
  } catch (error) {
    console.error(`[ScrapeEvents] Failed to emit update for run ${runId}:`, error);
  }
}
