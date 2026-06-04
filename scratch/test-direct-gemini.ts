import { getAIConfig } from "../lib/ai";

async function main() {
  const config = await getAIConfig();
  if (!config) {
    console.error("No AI configuration found.");
    return;
  }

  const prompt = `You are a UAE real estate lead scoring AI. Analyze the following lead and output a refined score from 0-100 and brief justification.
Lead Profile:
- Name: Unknown Contact
- Company: HNWI Source
- Role: Member
- Current Score: 50
- Tier: T2
- Status: new
- Budget Min: N/A
- Budget Max: N/A
- Location: Abu Dhabi
- Signals: HNWI Candidate
- Notes: None

Scoring criteria:
- Budget size (AED 2M+ = high value) → up to 30 pts
- Role seniority (C-suite, Owner, Director) → up to 25 pts
- Investment signals (UHNW, Investor) → up to 25 pts
- Location desirability (Palm, Downtown, Marina) → up to 10 pts
- Status momentum (qualified > contacted > new) → up to 10 pts

STABILITY CONSTRAINTS:
1. You MUST anchor your score calculations around the Current Score: 50.
2. Unless there is significant new evidence or context in the notes, signals, or status, the refinedScore must NOT deviate from the Current Score by more than +/- 10 points.
3. If the notes and signals do not contain any new information since the last assessment, you MUST output a refinedScore identical to the Current Score (50) and set the delta to 0.
4. Calculate the difference (refinedScore - Current Score) and report it as "delta".

Respond ONLY with valid JSON: {"refinedScore": <number>, "delta": <number>, "reasoning": "<1-2 sentence justification>", "recommendations": ["<action 1>", "<action 2>"]}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 8192,
      topP: 0.95,
      topK: 40
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  console.log("Calling fetch with 8192 tokens...");
  
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Full Raw Data:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
