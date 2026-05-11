import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const body = await req.json();
    const { lead, lang = "en" } = body;

    if (!lead) {
      return NextResponse.json({ error: "Lead data is required" }, { status: 400 });
    }

    // Simulate news retrieval (in production this would query news APIs)
    const relevantSignals = UAE_SIGNALS_DB.sort(() => Math.random() - 0.5).slice(0, 3);
    const newsContext = relevantSignals.join("\n");

    const prompt = `You are a UAE real estate intelligence analyst. Extract investment signals from the following news snippets about a lead.

Lead: ${lead.name}, ${lead.role} at ${lead.company}
Current signals: ${Array.isArray(lead.signals) ? lead.signals.join(", ") : lead.signals}

News intelligence:
${newsContext}

Extract 2-4 concise investment signal tags (max 4 words each) that indicate purchase intent or wealth indicators.
Also provide a brief intelligence summary (2 sentences max).

${lang === "ar" ? "أجب باللغة العربية للملخص، لكن الوسوم يجب أن تكون بالإنجليزية." : ""}

Respond ONLY with valid JSON: {"signals": ["signal1", "signal2"], "summary": "<intelligence summary>", "confidenceScore": <0-100>, "newsSnippets": ["<snippet 1>", "<snippet 2>"]}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 384,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text.trim() : "{}";

    let parsed: {
      signals: string[];
      summary: string;
      confidenceScore: number;
      newsSnippets: string[];
    };

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);
    } catch {
      return NextResponse.json({ error: "Invalid AI response format" }, { status: 502 });
    }

    return NextResponse.json({
      leadId: lead.id,
      extractedSignals: parsed.signals || [],
      summary: parsed.summary || "",
      confidenceScore: parsed.confidenceScore || 75,
      newsSnippets: relevantSignals,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[AI Signals Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to extract signals", detail: error?.message },
      { status: 500 }
    );
  }
}
