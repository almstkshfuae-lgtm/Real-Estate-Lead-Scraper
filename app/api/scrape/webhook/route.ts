import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { extractHNWILeads, enrichLeadWithAI, generatePersonaAnalysis, deduplicateSignals } from "@/lib/ai";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { getEnvVar } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secret, runId, sourceKey, scrapedData, isCompletedSignal } = body;

    const systemSecret = getEnvVar("SCRAPER_SECRET") || "scraper_secret_alpha_bravo";
    if (secret !== systemSecret) {
      console.warn("[Webhook] Unauthorized webhook call - secret mismatch");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!runId) {
      return NextResponse.json({ error: "Missing runId" }, { status: 400 });
    }

    // Fetch the corresponding ScrapeRun
    const scrapeRun = await prisma.scrapeRun.findUnique({
      where: { id: runId }
    });

    if (!scrapeRun) {
      console.error(`[Webhook] ScrapeRun not found: ${runId}`);
      return NextResponse.json({ error: "ScrapeRun not found" }, { status: 404 });
    }

    // Parse ScrapeRun metadata
    const requestedSources = JSON.parse(scrapeRun.sources) as string[];
    const criteria = JSON.parse(scrapeRun.criteria);
    const agentId = scrapeRun.triggeredBy;

    // Handle completed signal
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

    // Handle failed signal
    if (body.isFailedSignal) {
      const errorMsg = body.error ? String(body.error).replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : 'Unknown scraper error';
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

    if (!scrapedData || !sourceKey) {
      return NextResponse.json({ error: "Missing scrapedData or sourceKey" }, { status: 400 });
    }

    console.info(`[Webhook] Processing scraped data for source: ${sourceKey} in run: ${runId}`);

    // Stage 2: DOM Vital Data Check — reject empty/blocked pages before AI processing
    const contentText = String(scrapedData.content || '');
    const hasNameSignal = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(contentText);
    const hasRoleSignal = /\b(CEO|Director|Founder|Chairman|Manager|President|Partner|Owner|Executive|Member|Head|Managing)\b/i.test(contentText);
    const hasArabicNameSignal = /[\u0600-\u06FF]{2,}/.test(contentText);
    const hasArabicRoleSignal = /\b(رئيس|مدير|مؤسس|شريك|عضو)\b/.test(contentText);

    const sourceKeyLower = String(sourceKey || '').toLowerCase();
    const isRegistry = sourceKeyLower.includes('registry') ||
      sourceKeyLower.includes('chamber') ||
      sourceKeyLower.includes('adgm') ||
      sourceKeyLower.includes('difc') ||
      sourceKeyLower.includes('gazette');

    const passedDOMCheck = isRegistry || (
      contentText.length >= 200 && (
        hasNameSignal ||
        hasRoleSignal ||
        hasArabicNameSignal ||
        hasArabicRoleSignal
      )
    );

    if (!passedDOMCheck) {
      console.warn(`[Webhook] Source ${sourceKey} failed DOM vital check — content too short (${contentText.length} chars) or missing name/role patterns. Skipping AI extraction.`);
      return NextResponse.json({
        success: true,
        source: sourceKey,
        leadsProcessed: 0,
        skipped: true,
        reason: 'DOM vital data check failed — no extractable lead patterns detected'
      });
    }

    // AI Lead Extraction
    const extractedLeads = await extractHNWILeads(scrapedData, criteria);
    let newLeadsCount = 0;

    for (const lead of extractedLeads) {
      try {
        const enrichedLead = await enrichLeadWithAI(lead);
        const persona = await generatePersonaAnalysis(enrichedLead);

        await prisma.lead.upsert({
          where: {
            name_company_source: {
              name: enrichedLead.name,
              company: enrichedLead.company,
              source: enrichedLead.source || "HNWI Sources"
            }
          },
          update: {
            nameAr: enrichedLead.nameAr || null,
            companyAr: enrichedLead.companyAr || null,
            role: enrichedLead.role,
            roleAr: enrichedLead.roleAr || null,
            tier: enrichedLead.tier || 2,
            phone: enrichedLead.phone || null,
            email: enrichedLead.email || null,
            location: enrichedLead.location || "Abu Dhabi",
            latitude: enrichedLead.latitude ?? null,
            longitude: enrichedLead.longitude ?? null,
            score: enrichedLead.score || 50,
            signals: JSON.stringify(deduplicateSignals(enrichedLead.signals || [])),
            budgetMin: enrichedLead.budgetMin ?? null,
            budgetMax: enrichedLead.budgetMax ?? null,
            relocated: enrichedLead.relocated ?? false,
            propertyPref: JSON.stringify(enrichedLead.propertyPref || {}),
            persona,
            agentId: agentId,
            scrapeRunId: runId
          },
          create: {
            name: enrichedLead.name,
            nameAr: enrichedLead.nameAr || null,
            company: enrichedLead.company,
            companyAr: enrichedLead.companyAr || null,
            role: enrichedLead.role,
            roleAr: enrichedLead.roleAr || null,
            source: enrichedLead.source || "HNWI Sources",
            sourceType: enrichedLead.sourceType || "Unknown",
            tier: enrichedLead.tier || 2,
            phone: enrichedLead.phone || null,
            email: enrichedLead.email || null,
            location: enrichedLead.location || "Abu Dhabi",
            latitude: enrichedLead.latitude ?? null,
            longitude: enrichedLead.longitude ?? null,
            score: enrichedLead.score || 50,
            signals: JSON.stringify(deduplicateSignals(enrichedLead.signals || [])),
            budgetMin: enrichedLead.budgetMin ?? null,
            budgetMax: enrichedLead.budgetMax ?? null,
            relocated: enrichedLead.relocated ?? false,
            propertyPref: JSON.stringify(enrichedLead.propertyPref || {}),
            agentId: agentId,
            scrapeRunId: runId,
            persona
          }
        });

        newLeadsCount++;
      } catch (err: any) {
        console.error(`[Webhook] Error processing lead: ${lead.name}`, err);
      }
    }

    console.info(`[Webhook] Successfully processed ${newLeadsCount} leads from ${sourceKey}`);

    // Update leadsFound count dynamically
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
    const errorMsg = error.message ? error.message.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, '$1[REDACTED]:[REDACTED]@') : String(error);
    console.error("[Webhook] Pipeline processing error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
