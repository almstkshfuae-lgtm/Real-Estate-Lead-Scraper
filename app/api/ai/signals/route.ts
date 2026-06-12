import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText, deduplicateSignals } from "@/lib/ai";
import { signalsToString } from "@/lib/signals";
import { parseAIJson, AIJsonParseError } from "@/lib/ai-json";
import { getSession, isAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Predefined news signals for UAE high-profile individuals (simulated)
const UAE_SIGNALS_DB = [
  "Recently mentioned in Bloomberg MENA regarding $50M investment round",
  "Listed in Forbes Middle East 2024 Top 100 Investors",
  "Attended Abu Dhabi Investment Forum Q1 2025",
  "New company license registered in DIFC — expansion signal",
  "Acquired commercial property in Business Bay Q4 2024",
  "Profile updated on LinkedIn: 'Exploring UAE real estate opportunities'",
  "Mentioned in Gulf News report on luxury villa demand surge",
  "Attended Cityscape Global 2024 as VIP delegate",
  "New visa classification: 10-year Golden Visa holder",
  "Recent travel pattern: Dubai ↔ London ↔ Singapore — UHNW indicator",
];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { lead: bodyLead, leadId, lang = "en", generate = false } = body;

    const targetLeadId = leadId || bodyLead?.id;

    if (!targetLeadId) {
      return NextResponse.json({ error: "Lead ID or lead data is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: String(targetLeadId), deletedAt: null }
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Agents can only access their own leads
    if (!isAdmin(session.role) && lead.agentId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check cached signals
    const cachedSignals = (lead.metadata as any)?.aiSignals;
    if (!generate && cachedSignals) {
      return NextResponse.json({
        leadId: lead.id,
        extractedSignals: cachedSignals.extractedSignals || [],
        summary: cachedSignals.summary || "",
        confidenceScore: cachedSignals.confidenceScore || 75,
        newsSnippets: cachedSignals.newsSnippets || [],
        timestamp: cachedSignals.timestamp || new Date().toISOString(),
        isCached: true
      });
    }

    if (!generate) {
      return NextResponse.json({
        leadId: lead.id,
        extractedSignals: [],
        summary: null,
        confidenceScore: null,
        newsSnippets: [],
        isCached: false
      });
    }

    // Simulate news retrieval (in production this would query news APIs)
    const relevantSignals = UAE_SIGNALS_DB.sort(() => Math.random() - 0.5).slice(0, 3);
    const newsContext = relevantSignals.join("\n");

    const prompt = `You are a UAE real estate intelligence analyst. Extract investment signals from the following news snippets about a lead.

Lead: ${lead.name}, ${lead.role} at ${lead.company}
Current signals: ${signalsToString(lead.signals)}

News intelligence:
${newsContext}

Extract 2-4 concise investment signal tags (max 4 words each) that indicate purchase intent or wealth indicators.
Also provide a brief intelligence summary (2 sentences max).

CRITICAL PREAMBLE RULE:
Do NOT use generic, repetitive introductory templates or boilerplate prefixes (such as "Based on the news...", "بناءً على الأخبار...", "According to the...", etc.). Jump directly into the specific motivational, behavioral, and profile characteristics. Ensure each response is highly customized and specific.

${lang === "ar" ? "أجب باللغة العربية للملخص، لكن الوسوم يجب أن تكون بالإنجليزية." : ""}

Respond ONLY with valid JSON: {"signals": ["signal1", "signal2"], "summary": "<intelligence summary>", "confidenceScore": <0-100>, "newsSnippets": ["<snippet 1>", "<snippet 2>"]}`;

    const responseText = await generateGeminiText("", prompt, 512, undefined, 'signals', session.id);

    let parsed: {
      signals: string[];
      summary: string;
      confidenceScore: number;
      newsSnippets: string[];
    };

    try {
      parsed = parseAIJson<typeof parsed>(responseText ?? "");
    } catch (err) {
      if (err instanceof AIJsonParseError) {
        console.error("[AI Signals] JSON parse failed:", err.message, "| snippet:", err.rawSnippet);
        return NextResponse.json({ error: "AI returned an unstructured response. Please retry." }, { status: 502 });
      }
      throw err;
    }

    const cleanSignals = deduplicateSignals(parsed.signals || []);
    const newsSnippets = relevantSignals;
    const aiSignalsCache = {
      extractedSignals: cleanSignals,
      summary: parsed.summary || "",
      confidenceScore: parsed.confidenceScore || 75,
      newsSnippets,
      timestamp: new Date().toISOString()
    };

    // Update lead record with new signals and cached metadata
    const existingMetadata = (lead.metadata as Record<string, any>) || {};
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        signals: cleanSignals,
        metadata: {
          ...existingMetadata,
          aiSignals: aiSignalsCache
        }
      }
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Lead",
          entityId: lead.id,
          agentId: session.id,
          details: `Extracted and saved AI signals: ${cleanSignals.join(", ")}`
        }
      });
    } catch (auditErr) {
      console.error("[AI Signals] Failed to create audit log:", auditErr);
    }

    return NextResponse.json({
      leadId: lead.id,
      extractedSignals: cleanSignals,
      summary: parsed.summary || "",
      confidenceScore: parsed.confidenceScore || 75,
      newsSnippets,
      timestamp: aiSignalsCache.timestamp,
      isCached: false
    });
  } catch (error: any) {
    console.error("[AI Signals Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to extract signals", detail: error?.message },
      { status: 500 }
    );
  }
}
