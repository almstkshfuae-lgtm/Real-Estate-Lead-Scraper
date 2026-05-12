import Anthropic from "@anthropic-ai/sdk";
import { getSecret } from "./secrets";

async function getAnthropicClient() {
  const apiKey = await getSecret("anthropicApiKey");
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export async function extractLeadsFromText(text: string) {
  const anthropic = await getAnthropicClient();
  if (!anthropic) {
    console.warn("Anthropic API Key missing, skipping AI extraction");
    return [];
  }

  const systemPrompt = `You are an expert at extracting business leads from UAE news articles or snippets. 
  Extract the Person's Name, Company, and Role. 
  If multiple people are mentioned, extract all.
  Return a JSON array of objects: [{"name": "string", "company": "string", "role": "string", "signals": ["string"]}]. 
  If you can't find a name, do not create a lead.
  Signals should be short tags like "Company Expansion", "New Launch", "Investor".
  Output ONLY the JSON array.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: `Extract leads from this text: ${text}` }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (e) {
    console.error("AI extraction error:", e);
    return [];
  }
}

export async function enrichLeadWithAI(lead: any) {
  const anthropic = await getAnthropicClient();
  if (!anthropic) return lead;

  const systemPrompt = `Enrich the following lead data for a UAE real estate platform. 
  Assign an investment score (0-100) and tier (1=Elite, 2=Premium, 3=Standard).
  Tier 1: High net worth, CEOs, large company owners.
  Tier 2: Directors, senior managers.
  Tier 3: Others.
  Return JSON: {"score": number, "tier": number, "signals": string[]}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(lead) }],
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const enrichment = JSON.parse(jsonMatch[0]);
      return { ...lead, ...enrichment };
    }
    return lead;
  } catch (e) {
    console.error("AI enrichment error:", e);
    return lead;
  }
}
