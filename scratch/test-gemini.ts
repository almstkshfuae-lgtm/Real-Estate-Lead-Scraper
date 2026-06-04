import { generateGeminiText, getAIConfig, deduplicateSignals } from '../lib/ai.js';
import prisma from '../lib/prisma.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

async function test() {
  // Let the prisma client singleton do the initialization
  const lead = await prisma.lead.findFirst();
  if (!lead) {
    console.error('No lead found in the database to test with!');
    return;
  }
  console.log('Testing with lead:', { id: lead.id, name: lead.name, company: lead.company });

  // 1. Test Score Prompt
  const signalsStr = Array.isArray(lead.signals)
    ? lead.signals.join(", ")
    : JSON.stringify(lead.signals);

  const scorePrompt = `You are a UAE real estate lead scoring AI. Analyze the following lead and output a refined score from 0-100 and brief justification.

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
- Signals: ${signalsStr}
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

  console.log('\n--- Running AI Score test ---');
  try {
    const res = await generateGeminiText("", scorePrompt, 4096);
    console.log('Score AI response:', JSON.stringify(res));
    const trimmed = res?.trim() || "{}";
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(trimmed);
    console.log('Score Parsed successfully:', parsed);
  } catch (error: any) {
    console.error('Score AI generation or parsing failed:', error?.message || error);
  }

  // 2. Test Signals Prompt
  const UAE_SIGNALS_DB = [
    "Recently mentioned in Bloomberg MENA regarding $50M investment round",
    "Listed in Forbes Middle East 2024 Top 100 Investors",
  ];
  const newsContext = UAE_SIGNALS_DB.join("\n");
  const signalsPrompt = `You are a UAE real estate intelligence analyst. Extract investment signals from the following news snippets about a lead.

Lead: ${lead.name}, ${lead.role} at ${lead.company}
Current signals: ${signalsStr}

News intelligence:
${newsContext}

Extract 2-4 concise investment signal tags (max 4 words each) that indicate purchase intent or wealth indicators.
Also provide a brief intelligence summary (2 sentences max).

Respond ONLY with valid JSON: {"signals": ["signal1", "signal2"], "summary": "<intelligence summary>", "confidenceScore": <0-100>, "newsSnippets": ["<snippet 1>", "<snippet 2>"]}`;

  console.log('\n--- Running AI Signals test ---');
  try {
    const res = await generateGeminiText("", signalsPrompt, 4096);
    console.log('Signals AI response:', JSON.stringify(res));
    const trimmed = res?.trim() || "{}";
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(trimmed);
    console.log('Signals Parsed successfully:', parsed);
  } catch (error: any) {
    console.error('Signals AI generation or parsing failed:', error?.message || error);
  }
}

test()
  .catch(console.error)
  .finally(() => prisma.$raw.$disconnect());
