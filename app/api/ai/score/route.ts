import { NextRequest, NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/ai";
import prisma from "@/lib/prisma";
import { signalsToString } from "@/lib/signals";
import { parseAIJson, AIJsonParseError } from "@/lib/ai-json";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { leadId } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: String(leadId) } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const signals = signalsToString(lead.signals);

    const prompt = `You are a UAE real estate lead scoring AI. Analyze the following lead and output a refined score from 0-100 and brief justification.

Lead Profile:
- Name: ${lead.name}
- Company: ${lead.company}
- Role: ${lead.role}
- Current Score: ${lead.score}
- Tier: T${lead.tier}
- Status: ${lead.status}
- Budget Min: ${lead.budgetMin ? `AED ${lead.budgetMin.toLocaleString()}` : "N/A"}
- Budget Max: ${lead.budgetMax ? `AED ${lead.budgetMax.toLocaleString()}` : "N/A"}
- Location: ${lead.location || "N/A"}
- Signals: ${signals}
- Notes: ${lead.notes || "None"}

Scoring criteria:
- Budget size (AED 2M+ = high value) → up to 30 pts
- Role seniority (C-suite, Owner, Director) → up to 25 pts
- Investment signals (UHNW, Investor) → up to 25 pts
- Location desirability (Palm, Downtown, Marina) → up to 10 pts
- Status momentum (qualified > contacted > new) → up to 10 pts

STABILITY CONSTRAINTS:
1. You MUST anchor your score calculations around the Current Score: ${lead.score}.
2. Unless there is significant new evidence or context in the notes, signals, or status, the refinedScore must NOT deviate from the Current Score by more than +/- 10 points.
3. If the notes and signals do not contain any new information since the last assessment, you MUST output a refinedScore identical to the Current Score (${lead.score}) and set the delta to 0.
4. Calculate the difference (refinedScore - Current Score) and report it as "delta".

Respond ONLY with valid JSON: {"refinedScore": <number>, "delta": <number>, "reasoning": "<1-2 sentence justification>", "recommendations": ["<action 1>", "<action 2>"]}`;

    const responseText = await generateGeminiText("", prompt, 256, undefined, 'score', session.id);

    let parsed: {
      refinedScore: number;
      delta: number;
      reasoning: string;
      recommendations: string[];
    };

    try {
      parsed = parseAIJson<typeof parsed>(responseText ?? "");
    } catch (err: any) {
      if (err instanceof AIJsonParseError) {
        console.error("[AI Score] JSON parse failed:", err.message, "| snippet:", err.rawSnippet);
        return NextResponse.json({ error: "AI returned an unstructured response. Please retry." }, { status: 502 });
      }
      throw err; // re-throw unexpected errors
    }

    // Apply the refined score to the database
    const newScore = Math.max(0, Math.min(100, Math.round(Number(parsed.refinedScore) || 0)));
    await prisma.lead.update({
      where: { id: String(leadId) },
      data: { score: newScore },
    });

    return NextResponse.json({
      leadId: String(leadId),
      previousScore: lead.score,
      refinedScore: newScore,
      delta: newScore - lead.score,
      reasoning: parsed.reasoning,
      recommendations: parsed.recommendations || [],
    });
  } catch (error: any) {
    console.error("[AI Score Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to refine score", detail: error?.message },
      { status: 500 }
    );
  }
}
