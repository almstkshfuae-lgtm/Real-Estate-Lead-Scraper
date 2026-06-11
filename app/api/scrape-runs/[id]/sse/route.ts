import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { scrapeEvents } from "@/lib/scrape-events";

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
  const isAdmin = ['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(session.role.toUpperCase());

  // Helper function to process agent fallback if needed
  const handleAgentFallback = async (currentRun: any) => {
    if (!isAdmin && (currentRun.status === "FAILED" || (currentRun.status === "COMPLETED" && currentRun.leadsFound === 0))) {
      try {
        // Prevent concurrent duplicate fallback lead cloning
        const existingRunLeadsCount = await prisma.lead.count({
          where: { scrapeRunId: currentRun.id, agentId: session.id, deletedAt: null }
        });
        if (existingRunLeadsCount > 0) {
          console.info(`[SSE Fallback Check] Leads already exist for scrapeRunId ${currentRun.id}. Skipping clone.`);
          const updatedRun = {
            ...currentRun,
            status: "COMPLETED",
            leadsFound: existingRunLeadsCount,
            completedAt: currentRun.completedAt || new Date()
          };
          return updatedRun;
        }
        const agentLeads = await prisma.lead.findMany({
          where: { agentId: session.id, deletedAt: null },
          select: { name: true }
        });
        const existingNames = agentLeads.map(l => l.name);
        let adminLeads = await prisma.lead.findMany({
          where: {
            agent: { role: { in: ['admin', 'super admin', 'super_admin', 'superadmin'] } },
            name: { notIn: existingNames },
            deletedAt: null,
          },
          take: 100
        });
        if (adminLeads.length < 10) {
          adminLeads = await prisma.lead.findMany({
            where: { agent: { role: { in: ['admin', 'super admin', 'super_admin', 'superadmin'] } }, deletedAt: null },
            take: 100
          });
        }
        if (adminLeads.length > 0) {
          const shuffled = adminLeads.sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 10);
          let createdCount = 0;
          for (const adminLead of selected) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            const newSource = `${adminLead.source} (Match ${randomSuffix})`;
            try {
              await prisma.lead.create({
                data: {
                  name: adminLead.name,
                  nameAr: adminLead.nameAr,
                  company: adminLead.company,
                  companyAr: adminLead.companyAr,
                  role: adminLead.role,
                  roleAr: adminLead.roleAr,
                  source: newSource,
                  sourceType: adminLead.sourceType || "Match",
                  tier: adminLead.tier,
                  phone: adminLead.phone,
                  email: adminLead.email,
                  location: adminLead.location,
                  latitude: adminLead.latitude,
                  longitude: adminLead.longitude,
                  score: adminLead.score,
                  signals: adminLead.signals || [],
                  propertyPref: adminLead.propertyPref || {},
                  budgetMin: adminLead.budgetMin,
                  budgetMax: adminLead.budgetMax,
                  relocated: adminLead.relocated,
                  status: "new",
                  agentId: session.id,
                  scrapeRunId: currentRun.id,
                }
              });
              createdCount++;
            }
            catch (e) {
              console.error("[SSE fallback] Failed to clone fallback lead:", e);
            }
          }
          const updatedRun = await prisma.scrapeRun.update({
            where: { id: currentRun.id },
            data: {
              status: "COMPLETED",
              leadsFound: createdCount,
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
          return updatedRun;
        }
      }
      catch (fallbackError) {
        console.error("[SSE fallback] Error generating fallback leads for agent:", fallbackError);
      }
    }
    return currentRun;
  };

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

      // Check roles
      if (!isAdmin && run.triggeredBy !== session.id) {
        sendError("Forbidden");
        controller.close();
        return;
      }

      // Check for passive watchdog check on initial load (10 minutes)
      const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000;
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

      // Process fallback check if terminal failure or 0 results on initial load
      let activeRun = await handleAgentFallback(initialRun);

      // Parse sources
      let sourcesList = activeRun.sources;
      try {
        if (typeof sourcesList === "string") {
          sourcesList = JSON.parse(sourcesList);
        }
      } catch (e) {}

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

      // 2. Setup subscription to scrapeEvents
      const handleUpdate = async (runData: any) => {
        try {
          // Process fallback if terminal status is reached with 0 leads or failure
          const finalRunData = await handleAgentFallback(runData);

          let parsedSources = finalRunData.sources;
          try {
            if (typeof parsedSources === "string") {
              parsedSources = JSON.parse(parsedSources);
            }
          } catch (e) {}

          sendUpdate({
            run: {
              id: finalRunData.id,
              status: finalRunData.status,
              leadsFound: finalRunData.leadsFound,
              startedAt: finalRunData.startedAt,
              completedAt: finalRunData.completedAt,
              sources: parsedSources,
            }
          });

          if (finalRunData.status === "COMPLETED" || finalRunData.status === "FAILED") {
            cleanup();
          }
        } catch (err) {
          console.error("[SSE Stream] Event handler error:", err);
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        scrapeEvents.off(`run:${id}`, handleUpdate);
        try {
          controller.close();
        } catch (e) {}
      };

      scrapeEvents.on(`run:${id}`, handleUpdate);

      // 3. Set a backup timeout for the client connection (10 minutes)
      const timeoutTimer = setTimeout(() => {
        console.warn(`[SSE Stream] Connection timeout reached for run: ${id}`);
        sendUpdate({
          run: {
            ...activeRun,
            status: "FAILED",
            completedAt: new Date(),
          },
          error: "Scrape job timed out on server side.",
        });
        cleanup();
      }, ZOMBIE_TIMEOUT_MS);

      request.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
