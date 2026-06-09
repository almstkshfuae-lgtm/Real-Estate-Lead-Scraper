import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!API_KEY) {
  console.error('Missing GOOGLE_AI_API_KEY in environment!');
  process.exit(1);
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function reEvaluateLead(lead) {
  const prompt = `You are a real estate investment analyst specializing in UAE luxury real estate leads.
Analyze the following lead data and assign the appropriate investment tier and score.

TIER MAPPING (REQUIRED):
- Tier 1: Founders, CEOs, Chairmen, Club Leadership, UHNWI, Owner, President
- Tier 2: Directors, Managers, Specialists, Physicians, Club Members, Business owners
- Tier 3: Professionals, Employees, Associates, Standard income earners

SCORE MAPPING (0-100):
- 90-100: Very High likelihood (Tier 1 Elite)
- 70-89: High likelihood (Tier 1 / Tier 2)
- 50-69: Medium likelihood (Tier 2 / Tier 3)
- 30-49: Low likelihood (Tier 3)
- 0-29: Very low likelihood

Lead Role: ${lead.role}
Lead Company: ${lead.company}

Return ONLY a valid JSON object with keys "tier" (integer 1-3) and "score" (integer 0-100). No markdown formatting, no code blocks, just raw JSON.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 100 }
      })
    });

    if (!response.ok) {
      console.error(`API Error for Lead ${lead.id}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (text) {
      return JSON.parse(text);
    }
  } catch (error) {
    console.error(`Failed to parse AI response for Lead ${lead.id}:`, error.message);
  }
  return null;
}

async function run() {
  console.log('Fetching all leads...');
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads. Starting re-evaluation...`);

  let updated = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    console.log(`[${i+1}/${leads.length}] Evaluating: ${lead.name} (${lead.role} @ ${lead.company})...`);
    
    const result = await reEvaluateLead(lead);
    
    if (result && result.tier && result.score !== undefined) {
      const newTier = Math.max(1, Math.min(3, parseInt(result.tier)));
      const newScore = Math.max(0, Math.min(100, parseInt(result.score)));
      
      if (lead.tier !== newTier || lead.score !== newScore) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { tier: newTier, score: newScore }
        });
        console.log(`   -> Updated: Tier ${lead.tier}=>${newTier}, Score ${lead.score}=>${newScore}`);
        updated++;
      } else {
        console.log(`   -> Unchanged: Tier ${lead.tier}, Score ${lead.score}`);
      }
    }
    
    // Rate limit protection
    await delay(500);
  }

  console.log(`\nRe-evaluation complete! Updated ${updated} leads.`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
