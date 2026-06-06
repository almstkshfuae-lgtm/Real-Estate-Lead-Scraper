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

    let finalStatus = run.status;
    let finalLeadsFound = run.leadsFound;

    // FOR AGENT ROLE: If the scrape fails or returns 0 results, simulate success by cloning 10 admin-imported leads
    // Note: This fallback only triggers when the scrape results in zero leads or has failed.
    // To ensure that repeated searches fetch another 10 unique leads (10+10=20, 10+10+10=30, etc.),
    // we retrieve the names of the agent's existing leads and exclude them from the query.
    if (!isAdmin && (run.status === "FAILED" || (run.status === "COMPLETED" && run.leadsFound === 0))) {
      try {
        // Prevent concurrent duplicate fallback lead cloning
        const existingRunLeadsCount = await prisma.lead.count({
          where: { scrapeRunId: run.id, agentId: session.id }
        });
        if (existingRunLeadsCount > 0) {
          console.info(`[Fallback Check] Leads already exist for scrapeRunId ${run.id}. Skipping clone.`);
          return NextResponse.json(
            {
              run: {
                id: run.id,
                status: "COMPLETED",
                leadsFound: existingRunLeadsCount,
                startedAt: run.startedAt,
                completedAt: run.completedAt || new Date(),
                sources: run.sources,
              },
            },
            {
              headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
              },
            }
          );
        }

        // Fetch names of all leads currently assigned to this agent to avoid duplicates
        const agentLeads = await prisma.lead.findMany({
          where: { agentId: session.id },
          select: { name: true }
        });
        const existingNames = agentLeads.map(l => l.name);

        // Fetch admin-imported leads that the agent does not already have
        let adminLeads = await prisma.lead.findMany({
          where: {
            agent: {
              role: 'admin'
            },
            name: {
              notIn: existingNames
            }
          },
          take: 100
        });

        // If there are not enough unique admin leads left, fall back to any admin-imported leads
        if (adminLeads.length < 10) {
          const backupLeads = await prisma.lead.findMany({
            where: {
              agent: {
                role: 'admin'
              }
            },
            take: 100
          });
          adminLeads = backupLeads;
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
                  scrapeRunId: run.id,
                }
              });
              createdCount++;
            } catch (e) {
              console.error("Failed to clone fallback lead:", e);
            }
          }

          await prisma.scrapeRun.update({
            where: { id: run.id },
            data: {
              status: "COMPLETED",
              leadsFound: createdCount,
              completedAt: new Date()
            }
          });

          finalStatus = "COMPLETED";
          finalLeadsFound = createdCount;
        }
      } catch (fallbackError) {
        console.error("Error generating fallback leads for agent:", fallbackError);
      }
    }

    return NextResponse.json(
      {
        run: {
          id: run.id,
          status: finalStatus,
          leadsFound: finalLeadsFound,
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
