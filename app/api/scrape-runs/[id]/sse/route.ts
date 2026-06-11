import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cleanPhone } from "@/lib/sanitizer";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  if (!id || typeof id !== "string" || id.length < 10) {
    return new Response("Invalid run ID", { status: 400 });
  }

  const encoder = new TextEncoder();

  // Create stream
  const customStream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might have been closed by client
        }
      };

      const sendError = (errorMsg: string) => {
        try {
          controller.enqueue(encoder.encode(`event: error\ndata: ${errorMsg}\n\n`));
        } catch (e) {
          // Stream might have been closed
        }
      };

      // 1. Initial database fetch
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
        sendError("ScrapeRun not found");
        controller.close();
        return;
      }

      // Passive self-healing watchdog check
      const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
      let initialRun = run;
      if ((run.status === "PENDING" || run.status === "PROCESSING") &&
          Date.now() - new Date(run.startedAt).getTime() > ZOMBIE_TIMEOUT_MS) {
        console.warn(`[Watchdog] Passive SSE check: ScrapeRun ${id} has timed out on initial connection. Force-marking as FAILED.`);
        try {
          initialRun = await prisma.scrapeRun.update({
            where: { id },
            data: {
              status: "FAILED",
              completedAt: new Date()
            },
            select: {
              id: true,
              status: true,
              leadsFound: true,
              startedAt: true,
              completedAt: true,
              sources: true,
              triggeredBy: true,
            }
          });
        } catch (dbErr) {
          console.error(`[Watchdog] Passive SSE check failed to update ScrapeRun ${id}:`, dbErr);
        }
      }

      // Check roles
      const isAdmin = session.role.toUpperCase() === "ADMIN";
      if (!isAdmin && initialRun.triggeredBy !== session.id) {
        sendError("Forbidden");
        controller.close();
        return;
      }

      let activeRun = initialRun;

      // Parse sources
      let sourcesList = activeRun.sources;
      try {
        if (typeof sourcesList === "string") {
          sourcesList = JSON.parse(sourcesList);
        }
      } catch (e) {
        // Leave as is
      }

      sendUpdate({
        run: {
          id: activeRun.id,
          status: activeRun.status,
          leadsFound: activeRun.leadsFound,
          startedAt: activeRun.startedAt,
          completedAt: activeRun.completedAt,
          sources: sourcesList,
        }
      });

      // If already terminal state, finish immediately
      if (activeRun.status === "COMPLETED" || activeRun.status === "FAILED") {
        try {
          controller.close();
        } catch (e) {}
        return;
      }

      // 2. Loop & push updates
      const intervalMs = 1500;
      let elapsedMs = 0;
      const timeoutMs = 5 * 60 * 1000; // 5-minute timeout

      const interval = setInterval(async () => {
        try {
          elapsedMs += intervalMs;

          if (elapsedMs >= timeoutMs) {
            // Force status update to FAILED in database on timeout
            let timedOutRun;
            try {
              timedOutRun = await prisma.scrapeRun.update({
                where: { id },
                data: {
                  status: "FAILED",
                  completedAt: new Date(),
                },
                select: {
                  id: true,
                  status: true,
                  leadsFound: true,
                  startedAt: true,
                  completedAt: true,
                  sources: true,
                }
              });
            } catch (dbErr) {
              // Fallback if update fails
              timedOutRun = {
                id,
                status: "FAILED",
                leadsFound: activeRun.leadsFound,
                startedAt: activeRun.startedAt,
                completedAt: new Date(),
                sources: activeRun.sources,
              };
            }

            let parsedSources = timedOutRun.sources;
            try {
              if (typeof parsedSources === "string") {
                parsedSources = JSON.parse(parsedSources);
              }
            } catch (e) {}

            sendUpdate({
              run: {
                id: timedOutRun.id,
                status: timedOutRun.status,
                leadsFound: timedOutRun.leadsFound,
                startedAt: timedOutRun.startedAt,
                completedAt: timedOutRun.completedAt,
                sources: parsedSources,
              },
              error: "Scrape job timed out on server side.",
            });

            clearInterval(interval);
            try {
              controller.close();
            } catch (e) {}
            return;
          }

          const currentRun = await prisma.scrapeRun.findUnique({
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

          if (!currentRun) {
            clearInterval(interval);
            try {
              controller.close();
            } catch (e) {}
            return;
          }

          let checkedRun = currentRun;
          if ((currentRun.status === "PENDING" || currentRun.status === "PROCESSING") &&
              Date.now() - new Date(currentRun.startedAt).getTime() > ZOMBIE_TIMEOUT_MS) {
            console.warn(`[Watchdog] Passive SSE interval check: ScrapeRun ${id} has timed out. Force-marking as FAILED.`);
            try {
              checkedRun = await prisma.scrapeRun.update({
                where: { id },
                data: {
                  status: "FAILED",
                  completedAt: new Date()
                },
                select: {
                  id: true,
                  status: true,
                  leadsFound: true,
                  startedAt: true,
                  completedAt: true,
                  sources: true,
                  triggeredBy: true,
                }
              });
            } catch (dbErr) {
              console.error(`[Watchdog] Passive SSE interval check failed to update ScrapeRun ${id}:`, dbErr);
            }
          }

          const finalRun = checkedRun;

          let parsedSources = finalRun.sources;
          try {
            if (typeof parsedSources === "string") {
              parsedSources = JSON.parse(parsedSources);
            }
          } catch (e) {}

          sendUpdate({
            run: {
              id: finalRun.id,
              status: finalRun.status,
              leadsFound: finalRun.leadsFound,
              startedAt: finalRun.startedAt,
              completedAt: finalRun.completedAt,
              sources: parsedSources,
            }
          });

          if (finalRun.status === "COMPLETED" || finalRun.status === "FAILED") {
            clearInterval(interval);
            try {
              controller.close();
            } catch (e) {}
          }
        } catch (err) {
          console.error("[SSE Stream] Interval error:", err);
        }
      }, intervalMs);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
