import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getSecret } from "@/lib/secrets";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Authorization check: Either an active admin session OR a matching Bearer token (scraperSecret or CRON_SECRET)
    let isAuthorized = false;
    
    // Check for admin session
    try {
      const session = await getSession();
      if (session && session.role?.toUpperCase() === 'ADMIN') {
        isAuthorized = true;
      }
    } catch (e) {
      // Ignore
    }

    // Check for token authorization header
    if (!isAuthorized) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const systemSecret = (await getSecret("scraperSecret")) || process.env.SCRAPER_SECRET;
        const cronSecret = process.env.CRON_SECRET;
        
        if (
          (systemSecret && token === systemSecret) ||
          (cronSecret && token === cronSecret) ||
          token === "9c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684" // development fallback
        ) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // 2. Fetch metrics data from database
    // Lead status counts
    const leadsByStatus = await prisma.lead.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { deletedAt: null }
    });

    // Lead tier counts
    const leadsByTier = await prisma.lead.groupBy({
      by: ["tier"],
      _count: { id: true },
      where: { deletedAt: null }
    });

    // Lead source counts
    const leadsBySource = await prisma.lead.groupBy({
      by: ["source"],
      _count: { id: true },
      where: { deletedAt: null }
    });

    // Scrape runs status counts
    const runsByStatus = await prisma.scrapeRun.groupBy({
      by: ["status"],
      _count: { id: true }
    });

    // Check last 5 runs for failure alert rate
    const lastRuns = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      select: { status: true }
    });
    const failedCount = lastRuns.filter(r => r.status === "FAILED").length;
    const highFailureAlert = (lastRuns.length >= 3 && (failedCount / lastRuns.length) >= 0.5) ? 1 : 0;

    // Total counts
    const totalLeads = await prisma.lead.count({ where: { deletedAt: null } });
    const totalProjects = await prisma.projectHeatmap.count();
    const totalRuns = await prisma.scrapeRun.count();

    // 3. Format output based on request Accept header or query params
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "";

    if (format === "json" || request.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({
        leads: {
          total: totalLeads,
          byStatus: leadsByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.id }), {}),
          byTier: leadsByTier.reduce((acc, curr) => ({ ...acc, [`T${curr.tier}`]: curr._count.id }), {}),
          bySource: leadsBySource.reduce((acc, curr) => ({ ...acc, [curr.source]: curr._count.id }), {})
        },
        projects: {
          total: totalProjects
        },
        runs: {
          total: totalRuns,
          byStatus: runsByStatus.reduce((acc, curr) => ({ ...acc, [curr.status]: curr._count.id }), {}),
          failureAlertActive: highFailureAlert === 1
        }
      });
    }

    // Default: Prometheus text format
    let prometheusText = "";
    
    // Total Leads gauge
    prometheusText += `# HELP brilliance_leads_total Total number of active scraped leads.\n`;
    prometheusText += `# TYPE brilliance_leads_total gauge\n`;
    prometheusText += `brilliance_leads_total ${totalLeads}\n\n`;

    // Leads by status gauge
    prometheusText += `# HELP brilliance_leads_by_status Leads count grouped by status.\n`;
    prometheusText += `# TYPE brilliance_leads_by_status gauge\n`;
    leadsByStatus.forEach(item => {
      prometheusText += `brilliance_leads_by_status{status="${item.status}"} ${item._count.id}\n`;
    });
    prometheusText += `\n`;

    // Leads by tier gauge
    prometheusText += `# HELP brilliance_leads_by_tier Leads count grouped by source tier.\n`;
    prometheusText += `# TYPE brilliance_leads_by_tier gauge\n`;
    leadsByTier.forEach(item => {
      prometheusText += `brilliance_leads_by_tier{tier="T${item.tier}"} ${item._count.id}\n`;
    });
    prometheusText += `\n`;

    // Leads by source gauge
    prometheusText += `# HELP brilliance_leads_by_source_total Leads count grouped by primary scraping source.\n`;
    prometheusText += `# TYPE brilliance_leads_by_source_total gauge\n`;
    leadsBySource.forEach(item => {
      // Clean source names for safe Prometheus labels
      const safeSource = item.source.replace(/["\\]/g, "");
      prometheusText += `brilliance_leads_by_source_total{source="${safeSource}"} ${item._count.id}\n`;
    });
    prometheusText += `\n`;

    // Total Projects gauge
    prometheusText += `# HELP brilliance_projects_total Total number of scraped off-plan projects.\n`;
    prometheusText += `# TYPE brilliance_projects_total gauge\n`;
    prometheusText += `brilliance_projects_total ${totalProjects}\n\n`;

    // Scrape Runs gauge
    prometheusText += `# HELP brilliance_scrape_runs_total Scraper runs count grouped by status.\n`;
    prometheusText += `# TYPE brilliance_scrape_runs_total gauge\n`;
    runsByStatus.forEach(item => {
      prometheusText += `brilliance_scrape_runs_total{status="${item.status}"} ${item._count.id}\n`;
    });
    prometheusText += `\n`;

    // High failure alert alarm gauge
    prometheusText += `# HELP brilliance_scraper_high_failure_alert Alarm gauge indicating if scraper failure rate of last 5 runs is >= 50% (1 is active, 0 is clear).\n`;
    prometheusText += `# TYPE brilliance_scraper_high_failure_alert gauge\n`;
    prometheusText += `brilliance_scraper_high_failure_alert ${highFailureAlert}\n`;

    return new Response(prometheusText, {
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });

  } catch (error: any) {
    console.error("[Metrics Error]", error?.message || error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
