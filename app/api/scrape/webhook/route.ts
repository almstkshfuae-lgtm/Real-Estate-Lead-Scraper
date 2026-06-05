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
import { z } from "zod";

// Schema for individual lead validation
const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  nameAr: z.string().optional().nullable(),
  company: z.string().trim().min(1, "Company is required"),
  companyAr: z.string().optional().nullable(),
  role: z.string().optional().nullable(),
  roleAr: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  sourceType: z.string().optional().nullable(),
  tier: z.number().int().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  signals: z.array(z.string()).optional().nullable(),
  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  relocated: z.boolean().optional().nullable(),
  propertyPref: z.any().optional().nullable(),
  persona: z.string().optional().nullable(),
});

// Schema for webhook request payload
const webhookPayloadSchema = z.object({
  secret: z.string(),
  runId: z.string().min(1, "runId is required"),
  sourceKey: z.string().optional().nullable(),
  isStartedSignal: z.boolean().optional().nullable(),
  isCompletedSignal: z.boolean().optional().nullable(),
  isFailedSignal: z.boolean().optional().nullable(),
  error: z.any().optional().nullable(),
  enrichedLeads: z.array(leadSchema).optional().nullable(),
  selectorIssues: z.array(z.string()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    // Strict payload validation using Zod
    const validation = webhookPayloadSchema.safeParse(rawBody);
    if (!validation.success) {
      console.warn("[Webhook] Invalid payload format:", validation.error.format());
      return NextResponse.json({ error: "Invalid payload format", details: validation.error.format() }, { status: 400 });
    }

    const { secret, runId, sourceKey, enrichedLeads, isStartedSignal, isCompletedSignal, isFailedSignal, error, selectorIssues } = validation.data;

    let systemSecret = process.env.SCRAPER_SECRET;
    console.log("[Webhook Debug] systemSecret from env:", systemSecret, "NODE_ENV:", process.env.NODE_ENV);
    if (!systemSecret || systemSecret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL: SCRAPER_SECRET environment variable is missing in production!");
      }
      systemSecret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
      console.log("[Webhook Debug] fell back to systemSecret:", systemSecret);
    }
    console.log("[Webhook Debug] received secret:", secret, "expected:", systemSecret);
    if (secret !== systemSecret) {
      console.warn("[Webhook] Unauthorized webhook call - secret mismatch. Received:", secret, "Expected:", systemSecret);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // ── Started Signal ────────────────────────────────────────────────────────
    if (isStartedSignal) {
      console.info(`[Webhook] Received started signal for ScrapeRun: ${runId}`);
      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "PROCESSING"
        }
      });
      return NextResponse.json({ success: true, message: "Scrape run marked as processing" });
    }

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
    if (isFailedSignal) {
      const errorMsg = error
        ? String(error).replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, "$1[REDACTED]:[REDACTED]@")
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

    // Process selector issues if reported
    if (selectorIssues && Array.isArray(selectorIssues) && selectorIssues.length > 0) {
      console.warn(`[Webhook] Selector issues reported for source ${sourceKey}:`, selectorIssues);
      try {
        const sourceObj = await prisma.sourceConfig.findUnique({ where: { key: sourceKey } });
        const sourceName = sourceObj?.name || sourceKey;
        
        // Update SourceConfig in DB
        await prisma.sourceConfig.update({
          where: { key: sourceKey },
          data: {
            verificationStatus: "needs_review",
            interactionsPassed: false,
            verificationNotes: `Automatic health check failed: ${selectorIssues.join('; ')}`
          }
        });

        // Create alert notification for developer
        await prisma.notification.create({
          data: {
            agentId: agentId,
            title: `Scraper Alert: Broken Selectors in ${sourceName}`,
            body: `The system detected that some selectors for "${sourceName}" are no longer matching the DOM: ${selectorIssues.join(', ')}. Please check and update them in settings.`,
            type: "warning",
            data: JSON.stringify({ sourceKey, issues: selectorIssues })
          }
        });
        console.info(`[Webhook] Alert notification created for selector issues in ${sourceName}`);
      } catch (err: any) {
        console.error(`[Webhook] Failed to process selector issues for ${sourceKey}:`, err?.message || err);
      }
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
        console.error(`[Webhook] DB upsert error for lead: ${lead.name}`, err?.stack || err?.message || err);
        // Throw critical Prisma schema/table errors to prevent silent background failure
        if (err?.code === 'P2021' || err?.message?.includes('does not exist')) {
          throw err;
        }
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
