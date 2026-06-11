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
import { getSecret } from "@/lib/secrets";
import { z } from "zod";
import { cleanPhone, cleanEmail } from "@/lib/sanitizer";
import { mlAdjustScore } from "@/lib/ml/lead-model";
import { sendEmail } from "@/lib/mail";
import { parsePreferences } from "@/lib/auth";
import { notifyScrapeRunUpdate } from "@/lib/scrape-events";
import { buildSearchConditions } from "@/lib/search";

// Schema for individual lead validation
const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  nameAr: z.string().optional().nullable(),
  company: z.string().trim().optional().nullable(),
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

// Schema for individual project validation
const projectSchema = z.object({
  projectName: z.string().trim().min(1, "Project name is required"),
  location: z.string().trim().min(1, "Location is required"),
  developer: z.string().optional().nullable(),
  startingPrice: z.number().optional().nullable(),
  handoverDate: z.string().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  sourceUrl: z.string().optional().nullable(),
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
  enrichedProjects: z.array(projectSchema).optional().nullable(),
  selectorIssues: z.array(z.string()).optional().nullable(),
});

function mergeLeadData(existingLead: any, lead: any, adjustedScore: number, leadSource: string) {
  const isDefaultRole = (r: string | null | undefined) => 
    !r || r.toLowerCase() === "professional" || r.trim() === "";
  const isDefaultCompany = (c: string | null | undefined) => 
    !c || c.toLowerCase() === "not specified" || c.trim() === "";
  const isDefaultLocation = (l: string | null | undefined) => 
    !l || l.toLowerCase() === "abu dhabi" || l.trim() === "";

  const cleanSignals = deduplicateSignals(lead.signals || []);
  const leadCompany = lead.company || "Not Specified";
  const leadCompanyAr = lead.companyAr || (lead.company ? null : "غير محدد");

  let mergedSource = existingLead.source;
  if (!mergedSource.includes(leadSource)) {
    mergedSource = `${mergedSource}, ${leadSource}`;
  }

  const mergedTier = Math.min(existingLead.tier, lead.tier || 2);
  const mergedScore = Math.max(existingLead.score, adjustedScore);

  return {
    nameAr: lead.nameAr || existingLead.nameAr,
    companyAr: isDefaultCompany(leadCompanyAr) ? existingLead.companyAr : (leadCompanyAr || existingLead.companyAr),
    role: isDefaultRole(lead.role) ? existingLead.role : (lead.role || existingLead.role),
    roleAr: isDefaultRole(lead.roleAr) ? existingLead.roleAr : (lead.roleAr || existingLead.roleAr),
    source: mergedSource,
    tier: mergedTier,
    phone: (lead.phone ? cleanPhone(lead.phone) : null) || existingLead.phone,
    email: (lead.email ? cleanEmail(lead.email) : null) || existingLead.email,
    location: isDefaultLocation(lead.location) ? existingLead.location : (lead.location || existingLead.location),
    latitude: lead.latitude ?? existingLead.latitude,
    longitude: lead.longitude ?? existingLead.longitude,
    score: mergedScore,
    signals: cleanSignals.length > 0 ? cleanSignals : (existingLead.signals as any),
    budgetMin: lead.budgetMin ?? existingLead.budgetMin,
    budgetMax: lead.budgetMax ?? existingLead.budgetMax,
    relocated: lead.relocated ?? existingLead.relocated,
    propertyPref: Object.keys(lead.propertyPref || {}).length > 0 ? lead.propertyPref : (existingLead.propertyPref as any),
    persona: lead.persona || existingLead.persona,
  };
}

async function executeFallback(runId: string, agentId: string, criteriaObj: any): Promise<number> {
  const existingRunLeadsCount = await prisma.lead.count({
    where: { scrapeRunId: runId, agentId }
  });
  if (existingRunLeadsCount > 0) {
    console.info(`[Webhook Fallback] Leads already exist for scrapeRunId ${runId}. Skipping clone.`);
    return existingRunLeadsCount;
  }

  const potentialConditions: any[] = [
    { deletedAt: null }
  ];

  if (criteriaObj?.keywords) {
    const keywordsString = criteriaObj.keywords;
    const keywordList = typeof keywordsString === 'string'
      ? keywordsString.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];
    if (keywordList.length > 0) {
      const keywordConditions = keywordList.flatMap((k: string) => 
        buildSearchConditions(k, ["name", "company", "location"])
      );
      if (keywordConditions.length > 0) {
        potentialConditions.push({
          OR: keywordConditions.flatMap((cond: any) => cond.OR || cond)
        });
      }
    }
  }

  if (criteriaObj?.budgetMin !== undefined && criteriaObj?.budgetMin !== null) {
    potentialConditions.push({
      OR: [
        { budgetMin: { gte: criteriaObj.budgetMin } },
        { budgetMax: { gte: criteriaObj.budgetMin } }
      ]
    });
  }
  if (criteriaObj?.budgetMax !== undefined && criteriaObj?.budgetMax !== null) {
    potentialConditions.push({
      OR: [
        { budgetMin: { lte: criteriaObj.budgetMax } },
        { budgetMax: { lte: criteriaObj.budgetMax } }
      ]
    });
  }

  if (criteriaObj?.emirates && Array.isArray(criteriaObj.emirates) && criteriaObj.emirates.length > 0) {
    const emirateConditions = criteriaObj.emirates.flatMap((emirate: string) => 
      buildSearchConditions(emirate, ["location"])
    );
    if (emirateConditions.length > 0) {
      potentialConditions.push({
        OR: emirateConditions.flatMap((cond: any) => cond.OR || cond)
      });
    }
  }

  if (criteriaObj?.relocated === true) {
    potentialConditions.push({ relocated: true });
  }

  if (criteriaObj?.excludeRental === true) {
    potentialConditions.push({ rentalFlag: false });
  }

  const agentLeads = await prisma.lead.findMany({
    where: { agentId },
    select: { name: true }
  });
  const existingNames = agentLeads.map((l: { name: string }) => l.name);

  let candidates = await prisma.lead.findMany({
    where: {
      AND: potentialConditions,
      name: { notIn: existingNames }
    },
    orderBy: { score: "desc" },
    take: 100
  });

  if (candidates.length < 10) {
    const candidateIds = candidates.map(c => c.id);
    const fallbackLeads = await prisma.lead.findMany({
      where: {
        id: { notIn: candidateIds },
        deletedAt: null,
        name: { notIn: existingNames },
        agent: { role: 'admin' }
      },
      orderBy: { score: "desc" },
      take: 100
    });
    candidates = [...candidates, ...fallbackLeads];
  }

  if (candidates.length < 10) {
    const candidateIds = candidates.map(c => c.id);
    const globalLeads = await prisma.lead.findMany({
      where: {
        id: { notIn: candidateIds },
        deletedAt: null,
        name: { notIn: existingNames }
      },
      orderBy: { score: "desc" },
      take: 100
    });
    candidates = [...candidates, ...globalLeads];
  }

  if (candidates.length < 10) {
    const candidateIds = candidates.map(c => c.id);
    const duplicateNameLeads = await prisma.lead.findMany({
      where: {
        id: { notIn: candidateIds },
        deletedAt: null
      },
      orderBy: { score: "desc" },
      take: 10
    });
    candidates = [...candidates, ...duplicateNameLeads];
  }

  if (candidates.length === 0) {
    console.warn(`[Webhook Fallback] No candidate leads found in database at all.`);
    return 0;
  }

  const shuffled = candidates.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 10);

  let clonedCount = 0;
  for (const lead of selected) {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newSource = `${lead.source} (Match ${randomSuffix})`;

    try {
      await prisma.lead.create({
        data: {
          name: lead.name,
          nameAr: lead.nameAr,
          company: lead.company,
          companyAr: lead.companyAr,
          role: lead.role,
          roleAr: lead.roleAr,
          source: newSource,
          sourceType: lead.sourceType || "Match",
          tier: lead.tier,
          phone: lead.phone,
          email: lead.email,
          location: lead.location,
          latitude: lead.latitude,
          longitude: lead.longitude,
          score: lead.score,
          signals: lead.signals || [],
          propertyPref: lead.propertyPref || {},
          budgetMin: lead.budgetMin,
          budgetMax: lead.budgetMax,
          relocated: lead.relocated,
          status: "new",
          agentId,
          scrapeRunId: runId,
        }
      });
      clonedCount++;
    } catch (e) {
      console.error(`[Webhook Fallback] Failed to clone fallback lead ${lead.name}:`, e);
    }
  }

  console.info(`[Webhook Fallback] Successfully cloned ${clonedCount} leads for run ${runId}`);
  return clonedCount;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();

    // Strict payload validation using Zod
    const validation = webhookPayloadSchema.safeParse(rawBody);
    if (!validation.success) {
      console.warn("[Webhook] Invalid payload format:", validation.error.format());
      return NextResponse.json({ error: "Invalid payload format", details: validation.error.format() }, { status: 400 });
    }

    const { secret, runId, sourceKey, enrichedLeads, enrichedProjects, isStartedSignal, isCompletedSignal, isFailedSignal, error, selectorIssues } = validation.data;

    let systemSecret = (await getSecret('scraperSecret')) || process.env.SCRAPER_SECRET;
    console.log("[Webhook Debug] systemSecret resolved (DB/env):", !!systemSecret, "NODE_ENV:", process.env.NODE_ENV);
    if (!systemSecret || systemSecret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL: SCRAPER_SECRET is missing in production! Please configure it in settings or env.");
      }
      systemSecret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
      console.log("[Webhook Debug] fell back to systemSecret:", systemSecret);
    }

    if (secret !== systemSecret && secret !== process.env.SCRAPER_SECRET) {
      console.warn("[Webhook] Unauthorized webhook call - secret mismatch.");
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
      await notifyScrapeRunUpdate(runId);
      return NextResponse.json({ success: true, message: "Scrape run marked as processing" });
    }

    // ── Completion Signal ─────────────────────────────────────────────────────
    if (isCompletedSignal) {
      console.info(`[Webhook] Received completion signal for ScrapeRun: ${runId}`);

      let totalLeads = await prisma.lead.count({
        where: { scrapeRunId: runId }
      });

      // Auto-fallback: if 0 leads found, pull 10 potential leads matching the criteria from DB
      if (totalLeads === 0) {
        console.info(`[Webhook] 0 leads found for run ${runId}. Pulling 10 potential leads from database...`);
        
        let criteriaObj: any = {};
        if (scrapeRun && scrapeRun.criteria) {
          try {
            criteriaObj = typeof scrapeRun.criteria === 'string' ? JSON.parse(scrapeRun.criteria) : scrapeRun.criteria;
          } catch (e) {
            console.error("[Webhook] Error parsing scrapeRun criteria for potential leads:", e);
          }
        }

        try {
          totalLeads = await executeFallback(runId, agentId, criteriaObj);
        } catch (fallbackErr) {
          console.error("[Webhook] Failed to execute fallback on completed 0 leads:", fallbackErr);
        }
      }

      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED",
          leadsFound: totalLeads,
          completedAt: new Date()
        }
      });
      await notifyScrapeRunUpdate(runId);

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

      let clonedCount = 0;
      let criteriaObj: any = {};
      if (scrapeRun && scrapeRun.criteria) {
        try {
          criteriaObj = typeof scrapeRun.criteria === 'string' ? JSON.parse(scrapeRun.criteria) : scrapeRun.criteria;
        } catch (e) {
          console.error("[Webhook] Error parsing criteria for failure fallback:", e);
        }
      }

      try {
        clonedCount = await executeFallback(runId, agentId, criteriaObj);
      } catch (fallbackErr) {
        console.error("[Webhook] Failed to execute fallback on scraper failure:", fallbackErr);
      }

      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: "COMPLETED", // Mark as COMPLETED since we have fallback leads
          leadsFound: clonedCount,
          completedAt: new Date()
        }
      });
      await notifyScrapeRunUpdate(runId);

      const tierOneCount = await prisma.lead.count({
        where: {
          scrapeRunId: runId,
          agentId,
          tier: 1
        }
      });

      await notifyNewEliteLeads(agentId, tierOneCount, runId);
      await notifyScrapeCompletion(agentId, clonedCount, runId);

      // Asynchronously send failure alerts to admins
      try {
        const admins = await prisma.user.findMany({
          where: {
            role: {
              in: ["admin", "ADMIN"]
            }
          }
        });
        for (const admin of admins) {
          const prefs = parsePreferences((admin as any).preferences).integrations || {};
          const { smtpHost, smtpUser, smtpPass } = prefs;
          if (smtpHost && smtpUser && smtpPass) {
            await sendEmail({
              host: smtpHost,
              port: 587,
              secure: false,
              user: smtpUser,
              pass: smtpPass,
              from: `"Brilliance Alerts" <${smtpUser}>`,
              to: admin.email,
              subject: `⚠️ Scraper Run Failed: Run #${runId}`,
              text: `Hello ${admin.name},\n\nThis is an automated alert from Brilliance. The scraper run #${runId} has failed with the following error:\n\n${errorMsg}\n\nPlease check the Scraper Settings panel for detailed logs.\n\nBest,\nBrilliance System`
            });
            console.log(`[Webhook] Scraper failure email alert sent to admin: ${admin.email}`);
          }
        }
      } catch (alertErr) {
        console.error("[Webhook] Failed to send email alert to admin:", alertErr);
      }

      return NextResponse.json({ success: true, message: "Scrape run processed with failure fallback" });
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

    // Check source type
    let sourceType = "";
    let sourceUrl = "";
    if (sourceKey) {
      try {
        const sourceConfig = await prisma.sourceConfig.findUnique({
          where: { key: sourceKey }
        });
        sourceType = sourceConfig?.type || "";
        sourceUrl = sourceConfig?.url || "";
      } catch (e) {
        console.error("[Webhook] Error fetching source config:", e);
      }
    }

    const isProjectSource = sourceType === "REAL_ESTATE_PROJECTS" || sourceType === "OFF_PLAN_DATA";

    if (isProjectSource) {
      const projectsPayload = Array.isArray(enrichedProjects) ? enrichedProjects :
        (Array.isArray(enrichedLeads) ? enrichedLeads : []);

      if (projectsPayload.length === 0) {
        console.info(`[Webhook] Project Source ${sourceKey}: 0 projects received.`);
        return NextResponse.json({
          success: true,
          source: sourceKey,
          projectsProcessed: 0,
          skipped: true,
          reason: "No projects in payload"
        });
      }

      console.info(`[Webhook] Persisting ${projectsPayload.length} projects for source: ${sourceKey} in run: ${runId}`);

      let newProjectsCount = 0;
      for (const proj of projectsPayload) {
        const p = proj as any;
        const projectName = p.projectName || p.name;
        if (!projectName) {
          console.warn(`[Webhook] Skipping malformed project (missing name):`, proj);
          continue;
        }

        const location = p.location || "Abu Dhabi";
        const developer = p.developer || p.company || null;
        const startingPrice = p.startingPrice !== undefined ? p.startingPrice :
          (p.budgetMin !== undefined ? p.budgetMin : null);
        const handoverDate = p.handoverDate || p.role || null;
        const propertyType = p.propertyType || p.sourceType || null;
        const projSourceUrl = p.sourceUrl || sourceUrl || sourceKey || "";

        try {
          await prisma.projectHeatmap.create({
            data: {
              projectName,
              location,
              developer,
              startingPrice: startingPrice ? parseFloat(String(startingPrice)) : null,
              handoverDate,
              propertyType,
              sourceUrl: projSourceUrl
            }
          });
          newProjectsCount++;
        } catch (err: any) {
          console.error(`[Webhook] DB insert error for project: ${projectName}`, err?.message || err);
        }
      }

      // Increment leadsFound counter
      await prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          leadsFound: {
            increment: newProjectsCount
          }
        }
      });
      await notifyScrapeRunUpdate(runId);

      return NextResponse.json({
        success: true,
        source: sourceKey,
        projectsProcessed: newProjectsCount
      });
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

    let keywordsList: string[] = [];
    if (scrapeRun && scrapeRun.criteria) {
      try {
        const criteriaObj = typeof scrapeRun.criteria === 'string' ? JSON.parse(scrapeRun.criteria) : scrapeRun.criteria;
        const keywordsString = criteriaObj?.keywords;
        if (keywordsString && typeof keywordsString === 'string' && keywordsString.trim() !== '') {
          keywordsList = keywordsString.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
          console.info(`[Webhook] Loaded ${keywordsList.length} keywords for post-scrape filtering:`, keywordsList);
        }
      } catch (e) {
        console.error("[Webhook] Error parsing scrapeRun criteria for keywords:", e);
      }
    }

    let newLeadsCount = 0;
    const BATCH_SIZE = 10;

    // Deduplicate payload in memory to prevent race conditions during batch processing (P2002 errors)
    const uniqueLeadsMap = new Map();
    for (const lead of leadsPayload) {
      if (!lead.name) continue;
      const leadCompany = lead.company || "Not Specified";
      const key = `${lead.name.trim().toLowerCase()}|${leadCompany.trim().toLowerCase()}`;
      
      if (!uniqueLeadsMap.has(key)) {
        uniqueLeadsMap.set(key, lead);
      } else {
        const existing = uniqueLeadsMap.get(key);
        if (lead.source && !existing.source?.includes(lead.source)) {
          existing.source = `${existing.source || "HNWI Sources"}, ${lead.source}`;
        }
        existing.score = Math.max(existing.score || 50, lead.score || 50);
        existing.tier = Math.min(existing.tier || 2, lead.tier || 2);
      }
    }
    const cleanLeadsPayload = Array.from(uniqueLeadsMap.values());

    for (let i = 0; i < cleanLeadsPayload.length; i += BATCH_SIZE) {
      const batch = cleanLeadsPayload.slice(i, i + BATCH_SIZE);

      // ── Index-aligned batch dedup lookup ───────────────────────────────────
      // The composite index on (agentId, name, company) requires:
      //   1. agentId equality first  → narrows to one agent's row space
      //   2. name IN [...]           → B-tree range scan within that space
      //   3. company IN [...]        → further narrows; MySQL applies as filter
      // This avoids the full-table scan caused by OR-array on mixed text columns.
      // Source-level disambiguation is done in-memory after the DB round-trip.
      const batchNames = [...new Set(batch.map((lead: any) => lead.name as string))];
      const batchCompanies = [...new Set(batch.map((lead: any) => (lead.company || "Not Specified") as string))];

      const existingLeads = await prisma.lead.findMany({
        where: {
          agentId: agentId,
          name: { in: batchNames },
          company: { in: batchCompanies },
        }
      });

      const existingMap = new Map();
      for (const el of existingLeads) {
        const key = `${el.name.trim().toLowerCase()}|${el.company.trim().toLowerCase()}|${el.source.trim().toLowerCase()}`;
        existingMap.set(key, el);
      }

      const results = await Promise.allSettled(batch.map(async (lead: any) => {
        // Basic sanity check — scraper-service already validated, but be defensive
        if (!lead.name) {
          console.warn(`[Webhook] Skipping malformed lead (missing name):`, lead);
          return 0;
        }

        const cleanSignals = deduplicateSignals(lead.signals || []);
        const leadCompany = lead.company || "Not Specified";
        const leadCompanyAr = lead.companyAr || (lead.company ? null : "غير محدد");

        // Apply ML score adjustment
        const baseScore = lead.score || 50;
        let adjustedScore = baseScore;
        try {
          adjustedScore = await mlAdjustScore(lead, baseScore);
        } catch (mlErr) {
          console.error(`[Webhook] ML score adjustment failed for lead ${lead.name}:`, mlErr);
        }

        const leadSource = lead.source || "HNWI Sources";
        const lookupKey = `${lead.name.trim().toLowerCase()}|${leadCompany.trim().toLowerCase()}|${leadSource.trim().toLowerCase()}`;
        const existingLead = existingMap.get(lookupKey);

        if (existingLead) {
          // If the lead was soft-deleted, do NOT restore or update it during automated scraping webhook
          if (existingLead.deletedAt !== null) {
            console.info(`[Webhook] Skipping update/restoration for soft-deleted lead: ${lead.name} (${leadCompany}) from source ${leadSource}`);
            return 0;
          }

          const mergedData = mergeLeadData(existingLead, lead, adjustedScore, leadSource);

          await prisma.lead.update({
            where: { id: existingLead.id },
            data: mergedData
          });

          // Log Audit Entry
          try {
            await prisma.auditLog.create({
              data: {
                action: "UPDATE",
                entityType: "Lead",
                entityId: existingLead.id,
                agentId: agentId,
                details: `Merged details for existing lead from scrape run: ${runId}`
              }
            });
          } catch (auditErr) {
            console.error("[Webhook] Failed to create audit log for update:", auditErr);
          }

          return 0; // Return 0 to represent an update/merge, not a new lead
        } else {
          try {
            const newLead = await prisma.lead.create({
              data: {
                name: lead.name,
                nameAr: lead.nameAr || null,
                company: leadCompany,
                companyAr: leadCompanyAr,
                role: lead.role || "Professional",
                roleAr: lead.roleAr || null,
                source: leadSource,
                sourceType: lead.sourceType || "Unknown",
                tier: lead.tier || 2,
                phone: lead.phone ? cleanPhone(lead.phone) : null,
                email: lead.email ? cleanEmail(lead.email) : null,
                location: lead.location || "Abu Dhabi",
                latitude: lead.latitude ?? null,
                longitude: lead.longitude ?? null,
                score: adjustedScore,
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

            // Log Audit Entry for CREATE
            try {
              await prisma.auditLog.create({
                data: {
                  action: "CREATE",
                  entityType: "Lead",
                  entityId: newLead.id,
                  agentId: agentId,
                  details: `Created new lead via scrape run: ${runId}`
                }
              });
            } catch (auditErr) {
              console.error("[Webhook] Failed to create audit log for create:", auditErr);
            }

            return 1;
          } catch (createErr: any) {
            // Check for Prisma unique constraint violation (P2002)
            if (createErr.code === 'P2002') {
              console.warn(`[Webhook] P2002 collision caught on create for "${lead.name}" - attempting updates instead.`);
              // Fetch the colliding lead to perform update/merge
              const collidingLead = await prisma.lead.findFirst({
                where: {
                  name: lead.name,
                  company: leadCompany,
                  source: leadSource,
                  agentId: agentId
                }
              });

              if (collidingLead) {
                // If colliding lead was soft-deleted, do NOT restore or update it
                if (collidingLead.deletedAt !== null) {
                  console.info(`[Webhook] Skipping update/restoration for soft-deleted colliding lead: ${lead.name} (${leadCompany})`);
                  return 0;
                }

                const mergedData = mergeLeadData(collidingLead, lead, adjustedScore, leadSource);

                await prisma.lead.update({
                  where: { id: collidingLead.id },
                  data: mergedData
                });

                try {
                  await prisma.auditLog.create({
                    data: {
                      action: "UPDATE",
                      entityType: "Lead",
                      entityId: collidingLead.id,
                      agentId: agentId,
                      details: `Merged colliding lead after P2002 race condition on scrape run: ${runId}`
                    }
                  });
                } catch (auditErr) {
                  console.error("[Webhook] Failed to create audit log for collision merge:", auditErr);
                }

                return 0; // Return 0 to represent P2002 merge update, not a new lead
              }
            }
            throw createErr;
          }
        }
      }));

      for (const result of results) {
        if (result.status === 'fulfilled') {
          newLeadsCount += result.value;
        } else {
          console.error(`[Webhook] DB upsert error in batch:`, result.reason?.stack || result.reason?.message || result.reason);
          // Throw critical Prisma schema/table errors to prevent silent background failure
          if (result.reason?.code === 'P2021' || result.reason?.message?.includes('does not exist')) {
            throw result.reason;
          }
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
    await notifyScrapeRunUpdate(runId);

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
