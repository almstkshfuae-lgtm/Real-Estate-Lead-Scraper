import { getSecret } from "./secrets";

interface AIConfig {
  provider: 'openai' | 'google';
  apiKey: string;
  projectId?: string;
  location?: string;
  model: string;
}

async function getAIConfig(): Promise<AIConfig | null> {
  const openAiKey = process.env.OPENAI_API_KEY;
  const googleApiKey = (await getSecret("googleAiApiKey")) || process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  const googleProjectId = process.env.GOOGLE_AI_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const googleLocation = process.env.GOOGLE_AI_LOCATION || "us-central1";
  const googleModel = process.env.GOOGLE_AI_MODEL || process.env.GOOGLE_MODEL || "gemini-1.0";
  const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (googleApiKey) {
    return {
      provider: 'google',
      apiKey: googleApiKey,
      projectId: googleProjectId,
      location: googleLocation,
      model: googleModel
    };
  }

  if (openAiKey) {
    return {
      provider: 'openai',
      apiKey: openAiKey,
      model: openAiModel
    };
  }

  return null;
}

function formatCriteriaPrompt(criteria?: any) {
  if (!criteria || typeof criteria !== "object") {
    return "";
  }

  const lines: string[] = [
    "Use the following search criteria as strict filters. Discard any profile that does not match these criteria.",
  ];

  if (criteria.budgetMin !== undefined || criteria.budgetMax !== undefined) {
    lines.push(`Budget minimum: ${criteria.budgetMin ?? "any"}`);
    lines.push(`Budget maximum: ${criteria.budgetMax ?? "any"}`);
  }

  if (Array.isArray(criteria.emirates) && criteria.emirates.length > 0) {
    lines.push(`Locations: ${criteria.emirates.join(", ")}`);
  }

  if (Array.isArray(criteria.signals) && criteria.signals.length > 0) {
    lines.push(`Target signals: ${criteria.signals.join(", ")}`);
  }

  if (Array.isArray(criteria.propertyTypes) && criteria.propertyTypes.length > 0) {
    lines.push(`Desired property types: ${criteria.propertyTypes.join(", ")}`);
  }

  if (criteria.tierMin !== undefined) {
    lines.push(`Minimum required tier: ${criteria.tierMin}`);
  }

  if (criteria.recentlyRelocated !== undefined) {
    lines.push(`Recently relocated required: ${criteria.recentlyRelocated ? "Yes" : "No"}`);
  }

  if (criteria.excludeRental !== undefined) {
    lines.push(`Exclude rental-focused leads: ${criteria.excludeRental ? "Yes" : "No"}`);
  }

  return lines.join("\n");
}

function filterLeadByCriteria(lead: any, criteria?: any) {
  if (!criteria || typeof criteria !== "object") {
    return true;
  }

  if (Array.isArray(criteria.emirates) && criteria.emirates.length > 0) {
    const leadLocation = String(lead.location || "").toLowerCase();
    const matchesLocation = criteria.emirates.some((emirate: string) =>
      leadLocation.includes(emirate.toLowerCase())
    );
    if (!matchesLocation) {
      return false;
    }
  }

  if (criteria.tierMin !== undefined) {
    if (typeof lead.tier === "number" && lead.tier < criteria.tierMin) {
      return false;
    }
  }

  if (Array.isArray(criteria.signals) && criteria.signals.length > 0) {
    const leadSignals = Array.isArray(lead.signals) ? lead.signals.map((s: any) => String(s).toLowerCase()) : [];
    const matchesSignal = criteria.signals.some((signal: string) =>
      leadSignals.some((ls: string) => ls.includes(signal.toLowerCase())) ||
      String(lead.role || "").toLowerCase().includes(signal.toLowerCase()) ||
      String(lead.company || "").toLowerCase().includes(signal.toLowerCase())
    );
    if (!matchesSignal) {
      return false;
    }
  }

  if (criteria.excludeRental) {
    const rentalField = String(lead.role || "").toLowerCase() + " " + String(lead.company || "").toLowerCase();
    if (rentalField.includes("rent") || rentalField.includes("rental")) {
      return false;
    }
  }

  if (criteria.budgetMin !== undefined || criteria.budgetMax !== undefined) {
    const minBudget = Number((lead.budgetMin ?? lead.budget) || 0);
    const maxBudget = Number((lead.budgetMax ?? lead.budget) || 0);
    if (criteria.budgetMin !== undefined && maxBudget > 0 && maxBudget < criteria.budgetMin) {
      return false;
    }
    if (criteria.budgetMax !== undefined && minBudget > 0 && minBudget > criteria.budgetMax) {
      return false;
    }
  }

  return true;
}

async function generateOpenAIText(systemPrompt: string, userPrompt: string, maxTokens = 1024, apiKey: string, model: string) {
  const endpoint = "https://api.openai.com/v1/responses";
  const body = {
    model,
    input: `${systemPrompt}\n\n${userPrompt}`,
    max_output_tokens: maxTokens,
    temperature: 0.0,
    top_p: 0.95
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return extractTextFromAIResponse(data) || "";
}

function extractTextFromAIResponse(response: any): string {
  if (!response) {
    return "";
  }

  const candidate = response?.predictions?.[0] || response?.candidates?.[0] || response?.output?.[0] || response?.output || response;
  let contents = candidate?.content || candidate?.output || candidate?.text || candidate;

  if (!contents) {
    return "";
  }

  if (Array.isArray(contents)) {
    return contents
      .map((item: any) => (typeof item === "string" ? item : item?.text || ""))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof contents === "string") {
    return contents;
  }

  if (typeof contents === "object") {
    return Object.values(contents)
      .map((value: any) => (typeof value === "string" ? value : ""))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function pickFirstMatch(matches: string[] | null) {
  return matches && matches.length > 0 ? matches[0].trim() : null;
}

function normalizePhone(phone: string) {
  return phone.replace(/[\s\-().]/g, "").replace(/^00/, "+");
}

function extractLikelyNames(content: string) {
  const matches = new Set<string>();
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  const rolePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*,?\s*(?:CEO|Founder|Co-Founder|Chairman|President|Director|Managing Director|General Manager|Manager|Head)\b/gi;
  const reverseRolePattern = /\b(?:CEO|Founder|Co-Founder|Chairman|President|Director|Managing Director|General Manager|Manager|Head)\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/gi;

  let match: RegExpExecArray | null;
  while ((match = namePattern.exec(content))) {
    const candidate = match[1].trim();
    if (candidate.split(' ').length <= 4 && candidate.length > 6) {
      matches.add(candidate);
    }
  }

  while ((match = rolePattern.exec(content))) {
    matches.add(match[1].trim());
  }

  while ((match = reverseRolePattern.exec(content))) {
    matches.add(match[1].trim());
  }

  return Array.from(matches).slice(0, 5);
}

function extractLikelyRole(content: string) {
  const patterns = [
    /\b(CEO|Chief Executive Officer|Founder|Co-Founder|Chairman|President|Director|Managing Director|General Manager|Manager|Head of [A-Za-z ]+)\b/gi,
    /\b(Investor|Member|Partner|Executive|Owner)\b/gi
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match && match[1]) {
      return match[1];
    }
  }
  return "Member";
}

function heuristicExtractLeads(scrapedData: any, criteria?: any) {
  const content = String(scrapedData.content || "");
  const emails = Array.from(new Set((content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])));
  const phones = Array.from(new Set((content.match(/\+?[0-9][0-9()\-\.\s]{7,}[0-9]/g) || [])
    .map((value) => normalizePhone(value))));
  const company = scrapedData.name || scrapedData.title || "HNWI Source";
  const location = scrapedData.type?.includes("Dubai") ? "Dubai" : scrapedData.type?.includes("Abu Dhabi") ? "Abu Dhabi" : "Abu Dhabi";
  const role = extractLikelyRole(content);
  const tier = /\b(CEO|Chief Executive Officer|Founder|Co-Founder|Chairman|President|Director|Managing Director|General Manager)\b/i.test(content) ? 1 : 2;
  const score = tier === 1 ? 80 : 60;

  const names = extractLikelyNames(content);
  const leads = [] as any[];

  const candidates = names.length > 0 ? names : [company];

  for (let i = 0; i < candidates.length; i += 1) {
    const name = candidates[i];
    const email = emails[i] || emails[0] || null;
    const phone = phones[i] || phones[0] || null;

    const lead = {
      name: name || `Contact from ${company}`,
      nameAr: name || `جهة اتصال من ${company}`,
      company,
      companyAr: company,
      role,
      roleAr: role === "Member" ? "عضو" : role,
      email,
      phone,
      location,
      budgetMin: null,
      budgetMax: null,
      relocated: null,
      source: scrapedData.name || company,
      sourceType: scrapedData.type || "Unknown",
      tier,
      score,
      signals: Array.isArray(scrapedData.signals) ? scrapedData.signals : ["HNWI Candidate"]
    };

    if (lead.name && lead.company && lead.role) {
      leads.push(lead);
    }
  }

  if (leads.length === 0) {
    return [{
      name: `Lead from ${company}`,
      nameAr: `جهة اتصال من ${company}`,
      company,
      companyAr: company,
      role,
      roleAr: role === "Member" ? "عضو" : role,
      email: emails[0] || null,
      phone: phones[0] || null,
      location,
      budgetMin: null,
      budgetMax: null,
      relocated: null,
      source: scrapedData.name || company,
      sourceType: scrapedData.type || "Unknown",
      tier,
      score,
      signals: Array.isArray(scrapedData.signals) ? scrapedData.signals : ["HNWI Candidate"]
    }].filter((lead) => filterLeadByCriteria(lead, criteria));
  }

  return leads.filter((lead) => filterLeadByCriteria(lead, criteria));
}

async function generateGeminiText(systemPrompt: string, userPrompt: string, maxTokens = 1024) {
  const config = await getAIConfig();
  if (!config) {
    throw new Error("No AI provider configured. Set GOOGLE_AI_API_KEY or OPENAI_API_KEY.");
  }

  if (config.provider === 'openai') {
    return await generateOpenAIText(systemPrompt, userPrompt, maxTokens, config.apiKey, config.model);
  }

  const isProjectBased = Boolean(config.projectId);
  const body = isProjectBased
    ? {
        instances: [
          {
            content: `${systemPrompt}\n\n${userPrompt}`
          }
        ],
        parameters: {
          temperature: 0.0,
          maxOutputTokens: maxTokens,
          topP: 0.95,
          topK: 40
        }
      }
    : {
        prompt: {
          text: `${systemPrompt}\n\n${userPrompt}`
        },
        temperature: 0.0,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40
      };

  const endpoint = isProjectBased
    ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateText?key=${encodeURIComponent(config.apiKey)}`
    : `https://generativelanguage.googleapis.com/v1beta2/models/${config.model}:generateText?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 400 && errorText.includes("API key not valid")) {
      throw new Error("Gemini API key invalid or unauthorized. Verify GOOGLE_AI_API_KEY and project settings.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Gemini authentication error ${response.status}: ${errorText}`);
    }
    throw new Error(`Gemini API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return extractTextFromAIResponse(data) || "";
}

/**
 * Extract structured lead data from unstructured HNWI source content
 * Designed for processing DOM content from elite clubs, news portals, and business hubs
 * BILINGUAL: Extracts both English and Arabic translations
 */
export async function extractHNWILeads(scrapedData: {
  url: string;
  name: string;
  type: string;
  signals: string[];
  title: string;
  content: string;
}, criteria?: any) {
  const criteriaPrompt = formatCriteriaPrompt(criteria);

  const content = await generateGeminiText(
    `You are an expert at extracting high-net-worth individual (HNWI) leads from UAE business websites, club directories, news articles, and event listings.

CRITICAL INSTRUCTIONS:
1. Extract ONLY real people with verified context from the page
2. For each person, provide BOTH English AND Arabic names/companies/roles
3. Include ALL required fields for the database schema
4. Assign tier based on position: Tier 1 = Leadership/Ownership, Tier 2 = Management, Tier 3 = Standard
5. Calculate investment score (0-100) based on context
6. Apply the search criteria as strict filters and discard irrelevant or out-of-scope profiles before returning results

REQUIRED FIELDS FOR EACH LEAD:
- name (English) - Person's full name
- nameAr (Arabic) - Arabic translation of name (MUST INCLUDE)
- company (English) - Organization name
- companyAr (Arabic) - Arabic translation of company (MUST INCLUDE)
- role (English) - Position/Title
- roleAr (Arabic) - Arabic translation of role (MUST INCLUDE)
- location (String) - "Abu Dhabi", "Dubai", or city name - REQUIRED
- tier (1, 2, or 3) - REQUIRED: 1=Leadership/Founder, 2=Senior Management, 3=Professional
- score (0-100) - REQUIRED: Investment potential score
- email (String or null) - If visible on page
- phone (String or null) - If visible on page
- budgetMin (Number or null) - Estimated minimum budget if available
- budgetMax (Number or null) - Estimated maximum budget if available
- relocated (Boolean or null) - Mention of relocation or incoming move
- source (String) - "${scrapedData.name}"
- sourceType (String) - "${scrapedData.type}"
- signals (Array) - Business context clues

SCORING GUIDELINES (0-100):
- Leadership position (CEO, Chairman, Founder): +30 points
- Equestrian/Polo club member: +25 points
- Club board/committee member: +20 points
- Business owner/Director: +25 points
- News mention/Public figure: +15 points
- Professional/Manager: +10 points
- Multi-property interests: +10 points
- International business: +15 points
- Add contextual factors based on source

TIER ASSIGNMENT:
- Tier 1: Founders, CEOs, Chairmen, Polo/Equestrian club leadership, UHNWI
- Tier 2: Directors, Senior Managers, Club members, Business owners
- Tier 3: Professionals, Managers, Standard members

${criteriaPrompt}

Return a JSON array. ONLY include leads with complete name, company, and role.
For any missing Arabic translations, translate from English context.
For missing location, default to "Abu Dhabi".
For missing email/phone, set to null.
For missing budget values, set budgetMin and budgetMax to null.
For missing relocation context, set relocated to null.

Example format:
[
  {
    "name": "Sheikh Mohammed Al Maktoum",
    "nameAr": "الشيخ محمد آل مكتوم",
    "company": "Al Maktoum Holdings",
    "companyAr": "مجموعة آل مكتوم",
    "role": "Chairman",
    "roleAr": "رئيس مجلس الإدارة",
    "email": "m.almaktoum@holdings.ae",
    "phone": "+971501234567",
    "location": "Abu Dhabi",
    "budgetMin": null,
    "budgetMax": null,
    "relocated": null,
    "source": "${scrapedData.name}",
    "sourceType": "${scrapedData.type}",
    "tier": 1,
    "score": 95,
    "signals": ["Business Owner", "Equestrian Investor", "Leadership"]
  }
]

Output ONLY the JSON array. No other text.`,
    `Extract leads from this content:\n\nPage Title: ${scrapedData.title}\nSource: ${scrapedData.name}\nType: ${scrapedData.type}\n\nContent:\n${scrapedData.content}`,
    4096
  );

  if (!content) {
    console.warn("AI extraction unavailable, falling back to local heuristic extraction");
    return heuristicExtractLeads(scrapedData, criteria);
  }

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const leads = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  if (!Array.isArray(leads) || leads.length === 0) {
    console.warn("AI extraction returned no structured leads, falling back to local heuristic extraction");
    return heuristicExtractLeads(scrapedData, criteria);
  }

  return Array.isArray(leads)
    ? leads.filter((lead: any) =>
        lead.name && lead.company && lead.role && lead.tier && lead.score !== undefined && lead.location && filterLeadByCriteria(lead, criteria)
      )
    : [];
}

/**
 * Extract leads from general text content (news articles, snippets)
 */
export async function extractLeadsFromText(text: string, criteria?: any) {
  const criteriaPrompt = formatCriteriaPrompt(criteria);

  const content = await generateGeminiText(
    `You are an expert at extracting high-quality business leads from UAE news articles, event write-ups, and profile snippets.
    Extract the Person's Name, Company, Role, location, investment tier, score, and bilingual Arabic translations.

    REQUIRED FIELDS:
    - name (English)
    - nameAr (Arabic)
    - company (English)
    - companyAr (Arabic)
    - role (English)
    - roleAr (Arabic)
    - location (String)
    - tier (1, 2, or 3)
    - score (0-100)
    - signals (Array of strings)
    - email (String or null)
    - phone (String or null)
    - budgetMin (Number or null)
    - budgetMax (Number or null)
    - relocated (Boolean or null)

    Only return valid leads with a real person, company, and role. Default missing location to "Abu Dhabi".
    Apply the search criteria as strict filters and discard irrelevant profiles.
    Output ONLY a JSON array.

    ${criteriaPrompt}`,
    `Extract leads from this text: ${text}`,
    1024
  );

  if (!content) {
    console.warn("AI extraction unavailable, falling back to local heuristic text extraction");
    const heuristicLead = heuristicExtractLeads({
      name: "Text source",
      title: "Text source",
      type: "Text",
      signals: [],
      content: text
    }, criteria);
    return heuristicLead;
  }

  const jsonMatch = content.match(/\[[\s\S]*\]/);
  const leads = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

  if (!Array.isArray(leads) || leads.length === 0) {
    console.warn("AI text extraction returned no structured leads, falling back to local heuristic text extraction");
    return heuristicExtractLeads({
      name: "Text source",
      title: "Text source",
      type: "Text",
      signals: [],
      content: text
    }, criteria);
  }

  return Array.isArray(leads)
    ? leads.filter((lead: any) => lead.name && lead.company && lead.role && lead.tier && lead.score !== undefined && lead.location && filterLeadByCriteria(lead, criteria))
    : [];
}

/**
 * Enrich lead data with scoring, tier assignment, and signal extraction
 * Maps extracted fields to Prisma Lead schema
 */
export async function enrichLeadWithAI(lead: any) {
  const enrichedLead = {
    name: lead.name || "Unknown",
    nameAr: lead.nameAr || lead.name || "Unknown",
    company: lead.company || "Not Specified",
    companyAr: lead.companyAr || lead.company || "Not Specified",
    role: lead.role || "Professional",
    roleAr: lead.roleAr || lead.role || "Professional",
    email: lead.email || null,
    phone: lead.phone || null,
    location: lead.location || "Abu Dhabi",
    source: lead.source || "HNWI Sources",
    tier: lead.tier || 2,
    score: lead.score || 50,
    signals: lead.signals || [],
    sourceType: lead.sourceType || "Unknown",
    budgetMin: lead.budgetMin ?? null,
    budgetMax: lead.budgetMax ?? null,
    relocated: lead.relocated ?? null,
    propertyPref: lead.propertyPref || null
  };

  if (lead.tier && lead.score !== undefined) {
    return enrichedLead;
  }

  const content = await generateGeminiText(
    `You are a real estate investment analyst specializing in UAE luxury real estate leads.

Analyze the following lead data and assign the appropriate investment tier and score.

TIER MAPPING (REQUIRED):
- Tier 1: Ultra-High Net Worth individuals, Founders, CEOs, Chairmen, Club Leadership, Polo/Equestrian enthusiasts with ownership stake
- Tier 2: High Net Worth individuals, Directors, Managers, Club Members, Business owners
- Tier 3: Professionals, Employees, Standard income earners

SCORE MAPPING (0-100):
- 90-100: Very High likelihood
- 70-89: High likelihood
- 50-69: Medium likelihood
- 30-49: Low likelihood
- 0-29: Very low likelihood

Return ONLY this JSON object with keys tier and score. No explanatory text.`,
    JSON.stringify({
      name: enrichedLead.name,
      company: enrichedLead.company,
      role: enrichedLead.role,
      location: enrichedLead.location,
      source: enrichedLead.source,
      signals: enrichedLead.signals
    }),
    256
  );

  if (!content) {
    console.warn("Google Gemini API unavailable, using default tier/score");
    return enrichedLead;
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  if (result && result.tier && typeof result.score === "number") {
    return Object.assign({}, enrichedLead, {
      tier: Math.max(1, Math.min(3, result.tier)),
      score: Math.max(0, Math.min(100, result.score))
    });
  }

  return enrichedLead;
}

/**
 * Generate buyer persona analysis for detailed lead understanding
 */
export async function generatePersonaAnalysis(lead: any) {
  const content = await generateGeminiText(
    `You are a professional behavioral psychologist and UAE real estate investment analyst.
Analyze the following lead data and create a buyer persona.
Focus on:
1. Investment Motivation (Why they buy)
2. Risk Profile (Conservative vs Aggressive)
3. Lifestyle Alignment (What property suits them)
4. Decision Signals (UHNW, Executive, Business Owner)

Format the output as a concise, professional paragraph in the active language (English or Arabic).
Do not use placeholders. Use the data provided.`,
    JSON.stringify(lead),
    1024
  );

  if (!content) {
    console.warn("Google Gemini AI analysis unavailable");
    return "AI Analysis Unavailable";
  }

  return content;
}

/**
 * Bulk process multiple leads with parallel AI enrichment
 */
export async function enrichLeadsInBatch(leads: any[]) {
  return Promise.all(leads.map(lead => enrichLeadWithAI(lead)));
}

export { generateGeminiText };
