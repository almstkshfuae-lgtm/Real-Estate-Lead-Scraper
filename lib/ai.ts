import { getSecret } from "./secrets";
import { getEnvVar } from "./env";

interface AIConfig {
  apiKey: string;
  projectId?: string;
  location?: string;
  model: string;
}

export async function getAIConfig(): Promise<AIConfig | null> {
  // First prioritize env variables directly (faster, doesn't query DB during builds)
  const envGoogleKey = (getEnvVar('GOOGLE_AI_API_KEY') || getEnvVar('GOOGLE_API_KEY'))?.trim();
  const rawGoogleKey = envGoogleKey
    ? envGoogleKey
    : (await getSecret("googleAiApiKey"))?.trim();
  const googleApiKey = rawGoogleKey && !rawGoogleKey.startsWith('YOUR_') ? rawGoogleKey : null;

  const googleProjectId = (getEnvVar('GOOGLE_AI_PROJECT_ID') || getEnvVar('GOOGLE_PROJECT_ID') || getEnvVar('GOOGLE_CLOUD_PROJECT') || getEnvVar('GCLOUD_PROJECT'))?.trim();
  const googleLocation = (getEnvVar('GOOGLE_AI_LOCATION') || "us-central1")?.trim();

  let googleModel = (getEnvVar('GOOGLE_AI_MODEL') || getEnvVar('GOOGLE_MODEL') || "gemini-2.5-flash")?.trim();
  // Auto-upgrade legacy or invalid models to stable and fast gemini-2.5-flash
  if (
    !googleModel ||
    googleModel === "gemini-1.0" ||
    googleModel === "gemini-1.0-pro" ||
    googleModel === "gemini-1.5-flash" ||
    googleModel === "gemini-pro" ||
    googleModel === "gemini-flash-latest"
  ) {
    googleModel = "gemini-2.5-flash";
  }

  if (googleApiKey) {
    console.info('[AI] using Google provider (apiKey present)');
    return {
      apiKey: googleApiKey,
      projectId: googleProjectId,
      location: googleLocation,
      model: googleModel
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



function extractTextFromAIResponse(response: any): string {
  if (!response) {
    return "";
  }

  const candidate = response?.predictions?.[0] || response?.candidates?.[0] || response?.choices?.[0] || response?.output?.[0] || response?.output || response;
  let contents = candidate?.message?.content || candidate?.content || candidate?.output || candidate?.text || candidate;

  if (!contents) {
    return "";
  }

  if (typeof contents === "object" && Array.isArray(contents.parts)) {
    return contents.parts
      .map((part: any) => part.text || "")
      .filter(Boolean)
      .join("");
  }

  if (typeof candidate === "object" && Array.isArray(candidate.parts)) {
    return candidate.parts
      .map((part: any) => part.text || "")
      .filter(Boolean)
      .join("");
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

/**
 * Retry a function with exponential backoff on rate-limit or transient errors.
 * Handles Gemini 429 (Too Many Requests) and 503 (Service Unavailable).
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 8,
  baseDelayMs = 3000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('Service Unavailable');
      const isLastAttempt = attempt === maxAttempts;

      if (!isRateLimit || isLastAttempt) throw err;

      // Exponential backoff with ±500ms jitter to avoid thundering herd
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(
        `[AI] Gemini rate-limited (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('[AI] withRetry: max attempts exceeded — this line should be unreachable');
}

/**
 * Detect whether a Gemini JSON response was likely truncated due to maxOutputTokens limit.
 * Truncated responses end mid-structure (no closing ] or }) and are non-trivially long.
 */
function isLikelyTruncated(text: string): boolean {
  if (!text || text.length < 50) return false;
  const trimmed = text.trim();
  // A complete JSON array/object always ends with ] or }
  const lastChar = trimmed[trimmed.length - 1];
  return lastChar !== ']' && lastChar !== '}';
}

function safeParseJson(text: string, fallback: any = []): any {
  if (!text) return fallback;

  let cleanText = text.trim();

  // 1. Remove markdown code blocks if present anywhere in the text
  if (cleanText.includes("```")) {
    const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matches && matches[1]) {
      cleanText = matches[1].trim();
    }
  }

  // 2. Try to locate the JSON array or object boundaries explicitly
  const firstBracket = cleanText.indexOf('[');
  const lastBracket = cleanText.lastIndexOf(']');
  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');

  let jsonStr = cleanText;

  if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    jsonStr = cleanText.substring(firstBracket, lastBracket + 1);
  } else if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
  }

  // 3. Robust sanitization of control characters and backslashes
  // Remove all invalid ASCII control characters (0x00 to 0x1F) except newline (\n), carriage return (\r), and tab (\t)
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // Check for likely truncation before generic error logging
    if (isLikelyTruncated(text)) {
      console.warn('[AI] TRUNCATION DETECTED — Gemini response cut off before closing bracket.', {
        inputLength: text.length,
        lastChars: text.slice(-120),
        firstChars: text.slice(0, 120)
      });
    } else {
      console.error('[AI] JSON Parse failed for raw text:', text.substring(0, 500));
      console.error('[AI] Cleaned text attempt:', jsonStr.substring(0, 500));
    }

    try {
      const fixedJsonStr = jsonStr
        .replace(/,\s*\]/g, ']') // remove trailing comma in arrays
        .replace(/,\s*\}/g, '}') // remove trailing comma in objects
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"'); // normalize smart/curly quotes
      return JSON.parse(fixedJsonStr);
    } catch (innerError) {
      console.error('[AI] Secondary JSON parsing recovery failed:', innerError);
      if (fallback === null) return null;
      throw new Error("AI JSON Parsing Failed: Gemini returned an invalid or incomplete JSON response.");
    }
  }
}

function pickFirstMatch(matches: string[] | null) {
  return matches && matches.length > 0 ? matches[0].trim() : null;
}

function normalizePhone(phone: string) {
  return phone.replace(/[\s\-().]/g, "").replace(/^00/, "+");
}

export const UAE_AREAS_COORDS: Record<string, { lat: number; lng: number }> = {
  "Dubai Marina": { lat: 25.0807, lng: 55.1400 },
  "Palm Jumeirah": { lat: 25.1124, lng: 55.1390 },
  "Downtown Dubai": { lat: 25.1972, lng: 55.2744 },
  "Business Bay": { lat: 25.1860, lng: 55.2650 },
  "Jumeirah": { lat: 25.2048, lng: 55.2455 },
  "DIFC": { lat: 25.2108, lng: 55.2820 },
  "JBR": { lat: 25.0786, lng: 55.1341 },
  "Arabian Ranches": { lat: 25.0536, lng: 55.2710 },
  "Al Barsha": { lat: 25.1127, lng: 55.1992 },
  "Mirdif": { lat: 25.2218, lng: 55.4224 },
  "Deira": { lat: 25.2697, lng: 55.3095 },
  "Bur Dubai": { lat: 25.2532, lng: 55.2956 },
  "JVC": { lat: 25.0657, lng: 55.2105 },
  "Yas Island": { lat: 24.4672, lng: 54.6031 },
  "Al Reem Island": { lat: 24.4975, lng: 54.4186 },
  "Saadiyat Island": { lat: 24.5404, lng: 54.4416 },
  "Khalidiyah": { lat: 24.4755, lng: 54.3557 },
  "Al Raha Beach": { lat: 24.4293, lng: 54.5697 },
  "Corniche": { lat: 24.4638, lng: 54.3444 },
  "Sharjah City": { lat: 25.3463, lng: 55.4209 },
  "Al Nahda": { lat: 25.3007, lng: 55.4177 },
  "Al Khan": { lat: 25.3531, lng: 55.3795 },
  "Ajman": { lat: 25.4052, lng: 55.5136 },
  "Ras Al Khaimah": { lat: 25.7953, lng: 55.9788 },
  "Fujairah": { lat: 25.1288, lng: 56.3265 },
  "Dubai": { lat: 25.2048, lng: 55.2708 },
  "Abu Dhabi": { lat: 24.4539, lng: 54.3773 },
  "Umm Al Quwain": { lat: 25.5647, lng: 55.5534 }
};

export function resolveCoords(location: string): { lat: number; lng: number } {
  const normalized = location?.trim() || "";
  for (const [key, val] of Object.entries(UAE_AREAS_COORDS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }
  return { lat: 24.4539, lng: 54.3773 }; // Standard Abu Dhabi default center
}

export function normalizeLocation(loc: string): string {
  const normalized = (loc || "").trim();
  if (!normalized) return "Abu Dhabi";

  const lower = normalized.toLowerCase();

  if (lower.includes("ياس") || lower.includes("yas")) return "Yas Island";
  if (lower.includes("ريم") || lower.includes("reem")) return "Al Reem Island";
  if (lower.includes("سعديات") || lower.includes("saadiyat")) return "Saadiyat Island";
  if (lower.includes("خالدية") || lower.includes("khalidiyah") || lower.includes("khalidiya")) return "Khalidiyah";
  if (lower.includes("راحه") || lower.includes("raha")) return "Al Raha Beach";
  if (lower.includes("كورنيش") || lower.includes("corniche")) return "Corniche";
  if (lower.includes("مارينا") || lower.includes("marina")) return "Dubai Marina";
  if (lower.includes("نخلة") || lower.includes("palm")) return "Palm Jumeirah";
  if (lower.includes("وسط المدينة") || lower.includes("downtown")) return "Downtown Dubai";
  if (lower.includes("خليج الأعمال") || lower.includes("business bay")) return "Business Bay";
  if (lower.includes("جميرا") || lower.includes("jumeirah")) return "Jumeirah";
  if (lower.includes("العالمي") || lower.includes("difc")) return "DIFC";
  if (lower.includes("ممشى جي بي آر") || lower.includes("jbr")) return "JBR";
  if (lower.includes("المرابع") || lower.includes("ranches")) return "Arabian Ranches";
  if (lower.includes("البرشاء") || lower.includes("barsha")) return "Al Barsha";
  if (lower.includes("مردف") || lower.includes("mirdif")) return "Mirdif";
  if (lower.includes("ديرة") || lower.includes("deira")) return "Deira";
  if (lower.includes("بر دبي") || lower.includes("bur dubai")) return "Bur Dubai";
  if (lower.includes("قرية جميرا") || lower.includes("jvc")) return "JVC";
  if (lower.includes("شارقة") || lower.includes("sharjah")) return "Sharjah City";
  if (lower.includes("نهدة") || lower.includes("nahda")) return "Al Nahda";
  if (lower.includes("خان") || lower.includes("khan")) return "Al Khan";
  if (lower.includes("عجمان") || lower.includes("ajman")) return "Ajman";
  if (lower.includes("خيمة") || lower.includes("khaimah") || lower.includes("rak")) return "Ras Al Khaimah";
  if (lower.includes("فجيرة") || lower.includes("fujairah")) return "Fujairah";
  if (lower.includes("دبي") || lower.includes("dubai")) return "Dubai";
  if (lower.includes("أبوظبي") || lower.includes("abu dhabi") || lower.includes("abu_dhabi")) return "Abu Dhabi";
  if (lower.includes("أم القيوين") || lower.includes("quwain") || lower.includes("uaq")) return "Umm Al Quwain";

  for (const key of Object.keys(UAE_AREAS_COORDS)) {
    if (lower.includes(key.toLowerCase())) {
      return key;
    }
  }

  return "Abu Dhabi";
}

export function parseBudgetToFloat(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  if (typeof val !== 'string') return null;

  let str = val.trim().toLowerCase();
  if (!str) return null;

  // Extract digits and suffix (k, m, million, etc.)
  // Remove commas, currency symbols like aed, usd, $, etc.
  str = str.replace(/aed|usd|[\$,]/g, '').trim();

  const numMatch = str.match(/^([\d.]+)\s*(m|million|k|thousand)?/);
  if (!numMatch) {
    const fallbackVal = parseFloat(str);
    return isNaN(fallbackVal) ? null : fallbackVal;
  }

  let value = parseFloat(numMatch[1]);
  if (isNaN(value)) return null;

  const suffix = numMatch[2];
  if (suffix === 'm' || suffix === 'million') {
    value *= 1000000;
  } else if (suffix === 'k' || suffix === 'thousand') {
    value *= 1000;
  }

  return value;
}

export function deduplicateSignals(signals: any[]): string[] {
  if (!Array.isArray(signals)) return [];
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const sig of signals) {
    if (!sig || typeof sig !== 'string') continue;
    const cleanSig = sig.trim();
    if (!cleanSig) continue;
    const lower = cleanSig.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(cleanSig);
    }
  }
  return unique;
}

export function cleanScrapedText(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // 1. Strip script and style blocks entirely
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 2. Strip standard HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 3. Strip common footer/header boilerplate and noise words to focus AI attention
  const noisePatterns = [
    /terms of (?:service|use)|privacy policy|cookie policy|all rights reserved/gi,
    /share on (?:facebook|twitter|linkedin|whatsapp)/gi,
    /subscribe to newsletter|sign up for free/gi,
    /loading\.\.\.|please wait|click here to/gi,
    /follow us on|social media/gi,
  ];

  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  // 4. Normalize tab, carriage return, and space sequences
  cleaned = cleaned.replace(/[\t\r]/g, " ");
  cleaned = cleaned.replace(/\n\s*\n+/g, "\n"); // Collapse multiple blank lines
  cleaned = cleaned.replace(/ {2,}/g, " ");     // Collapse multiple double spaces

  // 5. Configurable truncation limit (default 100,000 characters) to avoid context saturation
  const envMax = process.env.AI_MAX_INPUT_CHARS || process.env.NEXT_PUBLIC_AI_MAX_INPUT_CHARS;
  const maxChars = envMax ? parseInt(envMax, 10) : 50000;
  if (cleaned.length > maxChars) {
    cleaned = cleaned.substring(0, maxChars) + "... [Truncated due to context window limits]";
  }

  return cleaned.trim();
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

async function generateGeminiText(systemPrompt: string, userPrompt: string, maxTokens = 1024, signal?: AbortSignal) {
  const config = await getAIConfig();
  if (!config) {
    console.error('[AI] no provider configured');
    throw new Error("No AI provider configured. Set GOOGLE_AI_API_KEY.");
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
      contents: [
        {
          parts: [
            {
              text: `${systemPrompt}\n\n${userPrompt}`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        maxOutputTokens: maxTokens,
        topP: 0.95,
        topK: 40
      }
    };

  const endpoint = isProjectBased
    ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateText?key=${encodeURIComponent(config.apiKey)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  // Wrap the fetch in withRetry to handle 429 / 503 rate-limits gracefully
  return withRetry(async () => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Log the error details for debugging (masking any potential sensitive snippets)
      try {
        console.error('[AI] Gemini API error', { status: response.status, body: errorText.substring(0, 1000) });
      } catch { }
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
  }, 8, 3000);
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
  const cleanedContent = cleanScrapedText(scrapedData.content);

  const isDirectorySource = scrapedData.type === 'Business Directory' ||
    scrapedData.type === 'Google Maps Business Directory' ||
    (scrapedData.name || '').toLowerCase().includes('maps') ||
    (scrapedData.name || '').toLowerCase().includes('yellow');

  const absoluteRule = isDirectorySource
    ? `0. ABSOLUTE RULE: Since this content is from a business directory (no individual human names are expected), you are permitted to extract the business/company itself as a lead if no specific human name is present.
For each business:
- For "name" and "nameAr", use a generic placeholder like "Representative of [Company Name]" or "ممثل [اسم الشركة]".
- Use the actual business/company name for "company" and "companyAr".
- Set "role" to "Corporate Contact" and "roleAr" to "جهة اتصال الشركة".
- Capture their telephone as "phone", website/email if present, and location.
NEVER invent or hallucinate contact numbers or locations; only extract what is explicitly written.`
    : `0. ABSOLUTE RULE: You MUST extract ONLY real data explicitly present in the provided text. If you cannot find an explicit name of a real estate client, investor, or HNWI with financial solvency indicators, return an EMPTY ARRAY [] immediately. It is STRICTLY FORBIDDEN to invent names, guess companies, or generate random data based on general context. Absence of real data = return []. No exceptions.
1. Extract ONLY real people with verified business context from the page.`;

  const content = await generateGeminiText(
    `You are an expert at extracting high-net-worth individual (HNWI) leads from UAE business websites, club directories, news articles, and event listings.

CRITICAL INSTRUCTIONS:
${absoluteRule}
2. If the page text is purely generic marketing copy, facility catalogs, sports package descriptions, pricing tables, or promotional articles with NO list of specific members, committee lists, board members, corporate leaders, or elite horse owners, DO NOT extract anything. You MUST return an empty array [] immediately.
3. NEVER extract general staff, copywriters, or random nouns. Only extract HNWIs (owners, directors, members).
4. For each person, provide BOTH English AND Arabic names/companies/roles.
5. Include ALL required fields for the database schema.
6. Assign tier based on position: Tier 1 = Leadership/Ownership, Tier 2 = Management, Tier 3 = Standard.
7. Calculate investment score (0-100) based on context, ensuring high variation (no flat 50 or 75 clustering).
8. Apply the search criteria as strict filters and discard irrelevant or out-of-scope profiles before returning results.

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
- persona (String) - REQUIRED: Full behavioral and investor profile analysis paragraph in the active language (English or Arabic). Limit to 2-3 sentences describing motivation, risk profile, and lifestyle/property alignment.

SCORING GUIDELINES (0-100) - EVALUATE TO ENSURE DIVERSE, CONTINUOUS SCORES:
Assign a specific, highly varied investment score based on this precise scale:
- 90-100: Elite UHNWI (Royal family, multi-billionaires, top-tier family offices, large conglomerate owners).
- 80-89: Elite HNWIs (CEOs of multinational firms, major real estate developers, active top equestrian/polo owners).
- 70-79: HNWIs (Founders, high-profile entrepreneurs, managing directors of established firms, venture capitalists).
- 60-69: Premium Clients (Directors, general managers, partners, luxury property seekers, multi-property investors).
- 50-59: Standard Business Profiles (Managers, professionals, consultants, high-earning corporate employees).
- Below 50: Standard employees or low-likelihood seekers (never default to flat 50 or 75, provide specific values like 53, 67, 72, 84, 91 based on exact context).

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
    "signals": ["Business Owner", "Equestrian Investor", "Leadership"],
    "persona": "A high-profile real estate investor seeking luxury waterfront villas. Displays a growth-oriented, aggressive risk profile with focus on immediate off-plan capital appreciation."
  }
]

Output ONLY the JSON array. No other text.`,
    `Extract leads from this content:\n\nPage Title: ${scrapedData.title}\nSource: ${scrapedData.name}\nType: ${scrapedData.type}\n\nContent:\n${cleanedContent}`,
    4096
  );

  if (!content) {
    console.warn("[AI] AI extraction unavailable — no content returned by Gemini.");
    throw new Error("AI extraction failed: Gemini returned empty content.");
  }

  let leads;
  try {
    leads = safeParseJson(content, null);
  } catch (err) {
    leads = null;
  }

  // Fix 5: If parse returned empty/failed AND response looks truncated, retry with a smaller budget
  if ((!leads || !Array.isArray(leads) || leads.length === 0) && isLikelyTruncated(content)) {
    console.warn('[AI] Truncated response detected — retrying Gemini call with reduced token budget (max 5 leads)...');
    const retryContent = await generateGeminiText(
      `You are an expert at extracting HNWI leads from UAE business content.
${isDirectorySource ? `ABSOLUTE RULE: Since this content is from a business directory (no individual human names are expected), you are permitted to extract the business/company itself as a lead if no specific human name is present. Use a placeholder like "Representative of [Company Name]" for the name, use the company name for company, and "Corporate Contact" for role.` : `ABSOLUTE RULE: Extract ONLY real people explicitly named in the text. Return an EMPTY ARRAY [] if no real names are found.`}
Return a JSON array of at most 5 leads. Each lead MUST have: name, nameAr, company, companyAr, role, roleAr, location, tier, score, email, phone, budgetMin, budgetMax, relocated, source, sourceType, signals, persona.
Output ONLY the JSON array. No other text.`,
      `Page Title: ${scrapedData.title}\nSource: ${scrapedData.name}\nContent (truncated):\n${cleanedContent.substring(0, 6000)}`,
      4096
    );
    if (retryContent) {
      try {
        leads = safeParseJson(retryContent, []);
        console.info(`[AI] Truncation retry yielded ${Array.isArray(leads) ? leads.length : 0} leads.`);
      } catch (err) {
        console.error("[AI] Truncation retry parsing failed.");
        leads = null;
      }
    }
  }

  if (!leads || !Array.isArray(leads)) {
    throw new Error("AI JSON Parsing Failed after retries: Gemini returned an invalid or incomplete JSON response.");
  }

  if (!Array.isArray(leads) || leads.length === 0) {
    console.warn("[AI] AI extraction returned no structured leads — returning empty (no heuristic fallback)");
    return [];
  }

  return Array.isArray(leads)
    ? leads
      .filter((lead: any) =>
        lead.name && lead.company && lead.role && lead.tier && lead.score !== undefined && lead.location
        && filterLeadByCriteria(lead, criteria)
        && verifyLeadInSource(lead.name, lead.nameAr, cleanedContent, lead.company, lead.companyAr)
      )
      .map((lead: any) => ({
        ...lead,
        signals: deduplicateSignals(lead.signals)
      }))
    : [];
}

/**
 * Verify that the lead's name actually appears in the original source text.
 * Prevents AI hallucinations from entering the database.
 */
function verifyLeadInSource(
  name: string,
  nameAr: string | null | undefined,
  sourceText: string,
  company?: string | null,
  companyAr?: string | null
): boolean {
  if (!name || !sourceText) return false;

  const isPlaceholder = name.toLowerCase().startsWith('representative of') ||
    (nameAr && nameAr.startsWith('ممثل'));

  if (isPlaceholder && (company || companyAr)) {
    const normalizedSource = sourceText.toLowerCase();

    // Check English Company Match
    if (company) {
      const coLower = company.toLowerCase().trim();
      if (normalizedSource.includes(coLower)) {
        return true;
      }

      const stopWords = new Set([
        'al', 'el', 'bin', 'ibn', 'the', 'of', 'and', 'ltd', 'limited', 'llc', 'inc', 'co', 'company', 'group'
      ]);
      const coKeyWords = coLower
        .replace(/[\d().,\-_]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
      if (coKeyWords.length > 0) {
        const matches = coKeyWords.filter(word => normalizedSource.includes(word));
        const matchThreshold = Math.min(2, coKeyWords.length);
        if (matches.length >= matchThreshold) {
          return true;
        }
      }
    }

    // Check Arabic Company Match
    if (companyAr) {
      const normalizeArabic = (str: string) => {
        return str
          .replace(/[\u064B-\u0652]/g, "") // Remove Arabic diacritics
          .replace(/[أإآ]/g, "ا")          // Normalize Alef shapes
          .replace(/ة/g, "ه")             // Normalize Teh Marbouta
          .replace(/ى/g, "ي")             // Normalize Alef Maksoura
          .toLowerCase()
          .trim();
      };

      const normSourceAr = normalizeArabic(sourceText);
      const normCoAr = normalizeArabic(companyAr);
      if (normSourceAr.includes(normCoAr)) {
        return true;
      }
    }

    console.warn(`[AI] Directory entity "${company || ''}" (Arabic: "${companyAr || ''}") not found in source text — discarding lead`);
    return false;
  }

  const normalizedSource = sourceText.toLowerCase();

  const getKeyWords = (str: string) => {
    const stopWords = new Set([
      'al', 'el', 'bin', 'ibn', 'the', 'of', 'and',
      'sheikh', 'sheikha', 'dr', 'mr', 'mrs', 'ms', 'eng', 'ceo', 'founder', 'president'
    ]);
    return str
      .toLowerCase()
      .replace(/[\d().,\-_]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  };

  // 1. Check English Name Match
  const enKeyWords = getKeyWords(name);
  if (enKeyWords.length > 0) {
    const matches = enKeyWords.filter(word => normalizedSource.includes(word));
    const matchThreshold = Math.min(2, enKeyWords.length);
    if (matches.length >= matchThreshold) {
      return true;
    }
  } else {
    if (normalizedSource.includes(name.toLowerCase().trim())) {
      return true;
    }
  }

  // 2. Check Arabic Name Match
  if (nameAr) {
    const normalizeArabic = (str: string) => {
      return str
        .replace(/[\u064B-\u0652]/g, "") // Remove Arabic diacritics
        .replace(/[أإآ]/g, "ا")          // Normalize Alef shapes
        .replace(/ة/g, "ه")             // Normalize Teh Marbouta
        .replace(/ى/g, "ي")             // Normalize Alef Maksoura
        .toLowerCase()
        .trim();
    };

    const normSourceAr = normalizeArabic(sourceText);
    const normNameAr = normalizeArabic(nameAr);

    const stopWordsAr = new Set(['من', 'في', 'بن', 'ال', 'ابن', 'الشيخ', 'الشيخة', 'دكتور', 'سيد', 'سيدة', 'مهندس']);
    const arKeyWords = normNameAr.split(/\s+/).filter(word => word.length > 2 && !stopWordsAr.has(word));

    if (arKeyWords.length > 0) {
      const matchesAr = arKeyWords.filter(word => normSourceAr.includes(word));
      const matchThresholdAr = Math.min(2, arKeyWords.length);
      if (matchesAr.length >= matchThresholdAr) {
        return true;
      }
    } else {
      if (normSourceAr.includes(normNameAr)) {
        return true;
      }
    }
  }

  console.warn(`[AI] Hallucination detected: name "${name}" (Arabic: "${nameAr || ''}") not found in source text — discarding lead`);
  return false;
}

/**
 * Extract leads from general text content (news articles, snippets)
 */
export async function extractLeadsFromText(text: string, criteria?: any) {
  const criteriaPrompt = formatCriteriaPrompt(criteria);
  const cleanedText = cleanScrapedText(text);

  const content = await generateGeminiText(
    `You are an expert at extracting high-quality business leads from UAE news articles, event write-ups, and profile snippets.
    ABSOLUTE RULE: You MUST extract ONLY real data explicitly present in the provided text. If you cannot find an explicit name of a real estate client, investor, or HNWI with financial solvency indicators, return an EMPTY ARRAY [] immediately. It is STRICTLY FORBIDDEN to invent names, guess companies, or generate random data based on general context. Absence of real data = return []. No exceptions.
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
    - persona (String) - REQUIRED: Full behavioral and investor profile analysis paragraph in the active language (English or Arabic). Limit to 2-3 sentences describing motivation, risk profile, and lifestyle/property alignment.

    SCORING GUIDELINES (0-100) - EVALUATE TO ENSURE DIVERSE, CONTINUOUS SCORES:
    Assign a specific, highly varied investment score based on this precise scale:
    - 90-100: Elite UHNWI (Royal family, multi-billionaires, top-tier family offices, large conglomerate owners).
    - 80-89: Elite HNWIs (CEOs of multinational firms, major real estate developers, active top equestrian/polo owners).
    - 70-79: HNWIs (Founders, high-profile entrepreneurs, managing directors of established firms, venture capitalists).
    - 60-69: Premium Clients (Directors, general managers, partners, luxury property seekers, multi-property investors).
    - 50-59: Standard Business Profiles (Managers, professionals, consultants, high-earning corporate employees).
    - Below 50: Standard employees or low-likelihood seekers (never default to flat 50 or 75, provide specific values like 53, 67, 72, 84, 91 based on exact context).

    CRITICAL: If the input text is just generic marketing descriptions, brochures, facilities listings, or sport rules rather than actual lists/mentions of members, executives, or leaders, DO NOT extract anything. Return an empty array [] immediately. Do NOT extract staff names or copywriters.
    Only return valid leads with a real person, company, and role. Default missing location to "Abu Dhabi".
    Apply the search criteria as strict filters and discard irrelevant profiles.
    Output ONLY a JSON array.

    ${criteriaPrompt}`,
    `Extract leads from this text: ${cleanedText}`,
    1024
  );

  if (!content) {
    console.warn("[AI] AI text extraction unavailable — returning empty (no heuristic fallback)");
    return [];
  }

  const leads = safeParseJson(content, []);

  if (!Array.isArray(leads) || leads.length === 0) {
    console.warn("[AI] AI text extraction returned no structured leads — returning empty (no heuristic fallback)");
    return [];
  }

  return Array.isArray(leads)
    ? leads
      .filter((lead: any) => lead.name && lead.company && lead.role && lead.tier && lead.score !== undefined && lead.location
        && filterLeadByCriteria(lead, criteria)
        && verifyLeadInSource(lead.name, lead.nameAr, cleanedText, lead.company, lead.companyAr)
      )
      .map((lead: any) => ({
        ...lead,
        signals: deduplicateSignals(lead.signals)
      }))
    : [];
}

/**
 * Enrich lead data with scoring, tier assignment, and signal extraction
 * Maps extracted fields to Prisma Lead schema
 */
export async function enrichLeadWithAI(lead: any) {
  const normalizedLoc = normalizeLocation(lead.location);
  const coords = resolveCoords(normalizedLoc);

  const parsedMin = parseBudgetToFloat(lead.budgetMin);
  const parsedMax = parseBudgetToFloat(lead.budgetMax);

  const enrichedLead = {
    name: lead.name || "Unknown",
    nameAr: lead.nameAr || lead.name || "Unknown",
    company: lead.company || "Not Specified",
    companyAr: lead.companyAr || lead.company || "Not Specified",
    role: lead.role || "Professional",
    roleAr: lead.roleAr || lead.role || "Professional",
    email: lead.email || null,
    phone: lead.phone || null,
    location: normalizedLoc,
    latitude: lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : coords.lat,
    longitude: lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : coords.lng,
    source: lead.source || "HNWI Sources",
    tier: lead.tier || 2,
    score: lead.score || 50,
    signals: deduplicateSignals(lead.signals || []),
    sourceType: lead.sourceType || "Unknown",
    budgetMin: parsedMin,
    budgetMax: parsedMax,
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
    4096
  );

  if (!content) {
    console.warn("Google Gemini API unavailable, using default tier/score");
    return enrichedLead;
  }

  const result = safeParseJson(content, null);
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
export async function generatePersonaAnalysis(lead: any, lang = "en") {
  if (lead.persona) {
    const isArabicRequest = lang === "ar";
    const hasArabicLetters = /[\u0600-\u06FF]/.test(lead.persona);
    if ((isArabicRequest && hasArabicLetters) || (!isArabicRequest && !hasArabicLetters)) {
      return lead.persona;
    }
  }

  const content = await generateGeminiText(
    `You are a professional behavioral psychologist and UAE real estate investment analyst.
Analyze the following lead data and create a buyer persona.
Focus on:
1. Investment Motivation (Why they buy)
2. Risk Profile (Conservative vs Aggressive)
3. Lifestyle Alignment (What property suits them)
4. Decision Signals (UHNW, Executive, Business Owner)

Format the output as a concise, professional paragraph in ${lang === 'ar' ? 'Arabic (العربية)' : 'English'}.
Do not use placeholders. Use the data provided.`,
    JSON.stringify({
      name: lead.name,
      company: lead.company,
      role: lead.role,
      location: lead.location,
      score: lead.score,
      tier: lead.tier,
      signals: lead.signals,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      notes: lead.notes
    }),
    4096
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

export async function generateGeminiStream(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  signal?: AbortSignal
): Promise<ReadableStream<string>> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error("No AI provider configured. Set GOOGLE_AI_API_KEY.");
  }

  const isProjectBased = Boolean(config.projectId);
  const body = isProjectBased
    ? {
      instances: [{ content: `${systemPrompt}\n\n${userPrompt}` }],
      parameters: { temperature: 0.0, maxOutputTokens: maxTokens, topP: 0.95, topK: 40 }
    }
    : {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: maxTokens, topP: 0.95, topK: 40 }
    };

  const endpoint = isProjectBased
    ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:streamGenerateContent?key=${encodeURIComponent(config.apiKey)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini streaming API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      if (!reader) {
        controller.close();
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const chunkText = decoder.decode(value, { stream: true });

        let text = "";
        let cleanChunk = chunkText.trim();
        let shouldClose = false;

        if (cleanChunk.endsWith(']')) {
          shouldClose = true;
          cleanChunk = cleanChunk.substring(0, cleanChunk.length - 1).trim();
          if (cleanChunk.endsWith(',')) {
            cleanChunk = cleanChunk.substring(0, cleanChunk.length - 1).trim();
          }
        }

        if (cleanChunk.startsWith(',')) cleanChunk = cleanChunk.substring(1).trim();
        if (cleanChunk.startsWith('[')) cleanChunk = cleanChunk.substring(1).trim();

        if (cleanChunk) {
          try {
            const obj = JSON.parse(cleanChunk);
            const candidate = obj?.predictions?.[0] || obj?.candidates?.[0];
            const contents = candidate?.content || candidate;
            const parts = contents?.parts || contents;
            if (Array.isArray(parts)) {
              text = parts.map((p: any) => p.text || "").join("");
            } else if (typeof parts === "string") {
              text = parts;
            } else if (parts?.text) {
              text = parts.text;
            }
          } catch (e) {
            const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            const matches = [];
            while ((match = textRegex.exec(chunkText)) !== null) {
              try {
                matches.push(JSON.parse(`"${match[1]}"`));
              } catch {
                matches.push(match[1]);
              }
            }
            text = matches.join("");
          }
        }

        if (text) {
          controller.enqueue(text);
        }
        if (shouldClose) {
          controller.close();
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      if (reader) {
        reader.cancel(reason).catch(() => { });
      }
    }
  });
}

export async function generateGeminiChatStream(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens = 2048,
  signal?: AbortSignal
): Promise<ReadableStream<string>> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error("No AI provider configured. Set GOOGLE_AI_API_KEY.");
  }

  const isProjectBased = Boolean(config.projectId);

  // Map messages to Gemini API format. Gemini expects "user" and "model" roles (not "assistant").
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      topP: 0.95,
      topK: 40
    }
  };

  const endpoint = isProjectBased
    ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:streamGenerateContent?key=${encodeURIComponent(config.apiKey)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?key=${encodeURIComponent(config.apiKey)}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini streaming API error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async pull(controller) {
      if (!reader) {
        controller.close();
        return;
      }
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        const chunkText = decoder.decode(value, { stream: true });

        let text = "";
        let cleanChunk = chunkText.trim();
        let shouldClose = false;

        if (cleanChunk.endsWith(']')) {
          shouldClose = true;
          cleanChunk = cleanChunk.substring(0, cleanChunk.length - 1).trim();
          if (cleanChunk.endsWith(',')) {
            cleanChunk = cleanChunk.substring(0, cleanChunk.length - 1).trim();
          }
        }

        if (cleanChunk.startsWith(',')) cleanChunk = cleanChunk.substring(1).trim();
        if (cleanChunk.startsWith('[')) cleanChunk = cleanChunk.substring(1).trim();

        if (cleanChunk) {
          try {
            const obj = JSON.parse(cleanChunk);
            const candidate = obj?.predictions?.[0] || obj?.candidates?.[0];
            const contents = candidate?.content || candidate;
            const parts = contents?.parts || contents;
            if (Array.isArray(parts)) {
              text = parts.map((p: any) => p.text || "").join("");
            } else if (typeof parts === "string") {
              text = parts;
            } else if (parts?.text) {
              text = parts.text;
            }
          } catch (e) {
            const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            const matches = [];
            while ((match = textRegex.exec(chunkText)) !== null) {
              try {
                matches.push(JSON.parse(`"${match[1]}"`));
              } catch {
                matches.push(match[1]);
              }
            }
            text = matches.join("");
          }
        }

        if (text) {
          controller.enqueue(text);
        }
        if (shouldClose) {
          controller.close();
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      if (reader) {
        reader.cancel(reason).catch(() => { });
      }
    }
  });
}

export { generateGeminiText };
