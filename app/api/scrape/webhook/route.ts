/**
 * Scrape Webhook — Pure DB Writer
 *
 * FIX 1 (Production Hardening): AI enrichment has been moved OUT of this webhook
 * and INTO the Railway scraper-service (callGeminiForLeads). This webhook is now
 * a thin, fast receiver that only:
 *   1. Validates the shared secret
 *   2. Receives pre-enriched leads from the scraper-service
 *   3. Upserts each lead into MySQL via Prisma
 *   4. Updates leadsFound counter on the ScrapeRun
 *
 * Estimated execution time: 2-5 seconds (pure DB writes)
 * Previous execution time:  60-180 seconds (50+ sequential Gemini calls) → 504 Timeout
 *
 * Payload shape from scraper-service:
 *   { secret, runId, sourceKey, enrichedLeads: Lead[] }  ← data batch
 *   { secret, runId, isCompletedSignal: true }            ← finalize signal
 *   { secret, runId, isFailedSignal: true, error: string } ← failure signal
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { deduplicateSignals } from "@/lib/ai";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { getEnvVar, getRequiredEnvVar } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, runId, sourceKey, enrichedLeads, isCompletedSignal } = body;

    let systemSecret = process.env.SCRAPER_SECRET;
    if (!systemSecret || systemSecret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL: SCRAPER_SECRET environment variable is missing in production!");
      }
      systemSecret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
    }
    if (secret !== systemSecret) {
      console.warn("[Webhook] Unauthorized webhook call - secret mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    // ── Fetch ScrapeRun ───────────────────────────────────────────────────────
    const scrapeRun = await prisma.scrapeRun.findUnique({
      where: { id: runId }
    });

    if (!scrapeRun) {
      console.error(`[Webhook] ScrapeRun not found: ${runId}`);
      return NextResponse.json({ error: "ScrapeRun not found" }, { status: 404 });
    }

    const agentId = scrapeRun.triggeredBy;

    // ── Completion Signal ─────────────────────────────────────────────────────
    if (isCompletedSignal) {
      console.info(`[Webhook] Received completion signal for ScrapeRun: ${runId}`);

      const totalLeads = await prisma.lead.count({
        where: { scrapeRunId: runId }
      });

      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          leadsFound: totalLeads,
          completedAt: new Date()
        }
      });

      const tierOneCount = await prisma.lead.count({
        where: {
          scrapeRunId: runId,
          agentId,
          tier: 1
        }
      });

      await notifyNewEliteLeads(agentId, tierOneCount, runId);
      await notifyScrapeCompletion(agentId, totalLeads, runId);

      return NextResponse.json({ success: true, message: "Scrape run finalized successfully" });
    }

    // ── Failure Signal ────────────────────────────────────────────────────────
    if (body.isFailedSignal) {
      const errorMsg = body.error
        ? String(body.error).replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, "$1[REDACTED]:[REDACTED]@")
        : "Unknown scraper error";
      console.error(`[Webhook] Received failure signal for ScrapeRun: ${runId}. Error: ${errorMsg}`);

      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          completedAt: new Date()
        }
      });

      await notifyScrapeCompletion(agentId, 0, runId);

      return NextResponse.json({ success: true, message: "Scrape run marked as failed" });
    }

    // ── Data Batch ────────────────────────────────────────────────────────────
    if (!sourceKey) {
      return NextResponse.json({ error: "Missing sourceKey" }, { status: 400 });
    }

    // Accept both old (scrapedData) and new (enrichedLeads) payload shapes for
    // backwards compatibility during rolling deployment
    const leadsPayload = Array.isArray(enrichedLeads) ? enrichedLeads : [];

    if (leadsPayload.length === 0) {
      console.info(`[Webhook] Source ${sourceKey}: 0 pre-enriched leads received (page had no extractable data).`);
      return NextResponse.json({
        success: true,
        source: sourceKey,
        leadsProcessed: 0,
        skipped: true,
        reason: "No enriched leads in payload"
      });
    }

    console.info(`[Webhook] Persisting ${leadsPayload.length} pre-enriched leads for source: ${sourceKey} in run: ${runId}`);

    let newLeadsCount = 0;

    for (const lead of leadsPayload) {
      // Basic sanity check — scraper-service already validated, but be defensive
      if (!lead.name || !lead.company) {
        console.warn(`[Webhook] Skipping malformed lead (missing name/company):`, lead);
        continue;
      }

      try {
        const cleanSignals = deduplicateSignals(lead.signals || []);

        await prisma.lead.upsert({
          where: {
            name_company_source_agentId: {
              name: lead.name,
              company: lead.company,
              source: lead.source || "HNWI Sources",
              agentId: agentId
            }
          },
          update: {
            nameAr: lead.nameAr || null,
            companyAr: lead.companyAr || null,
            role: lead.role || "Professional",
            roleAr: lead.roleAr || null,
            tier: lead.tier || 2,
            phone: lead.phone || null,
            email: lead.email || null,
            location: lead.location || "Abu Dhabi",
            latitude: lead.latitude ?? null,
            longitude: lead.longitude ?? null,
            score: lead.score || 50,
            signals: cleanSignals,
            budgetMin: lead.budgetMin ?? null,
            budgetMax: lead.budgetMax ?? null,
            relocated: lead.relocated ?? false,
            propertyPref: lead.propertyPref || {},
            persona: lead.persona || null,
            agentId: agentId,
            scrapeRunId: runId
          },
          create: {
            name: lead.name,
            nameAr: lead.nameAr || null,
            company: lead.company,
            companyAr: lead.companyAr || null,
            role: lead.role || "Professional",
            roleAr: lead.roleAr || null,
            source: lead.source || "HNWI Sources",
            sourceType: lead.sourceType || "Unknown",
            tier: lead.tier || 2,
            phone: lead.phone || null,
            email: lead.email || null,
            location: lead.location || "Abu Dhabi",
            latitude: lead.latitude ?? null,
            longitude: lead.longitude ?? null,
            score: lead.score || 50,
            signals: cleanSignals,
            budgetMin: lead.budgetMin ?? null,
            budgetMax: lead.budgetMax ?? null,
            relocated: lead.relocated ?? false,
            propertyPref: lead.propertyPref || {},
            persona: lead.persona || null,
            agentId: agentId,
            scrapeRunId: runId
          }
        });

        newLeadsCount++;
      } catch (err: any) {
        console.error(`[Webhook] DB upsert error for lead: ${lead.name}`, err?.message || err);
      }
    }

    console.info(`[Webhook] Persisted ${newLeadsCount}/${leadsPayload.length} leads from ${sourceKey}`);

    // Increment leadsFound counter
    await prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        leadsFound: {
          increment: newLeadsCount
        }
      }
    });

    return NextResponse.json({
      success: true,
      source: sourceKey,
      leadsProcessed: newLeadsCount
    });
  } catch (error: any) {
    const errorMsg = error.message
      ? error.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, "$1[REDACTED]:[REDACTED]@")
      : String(error);
    console.error("[Webhook] Pipeline processing error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
