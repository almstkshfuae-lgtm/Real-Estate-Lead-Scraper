import { getSecret } from "./secrets";
import { getEnvVar } from "./env";
import { callGemini, BudgetExceededError, type AiTaskType } from "./ai-gateway";
import {
  withRetry,
  safeParseJson,
  isLikelyTruncated,
  extractTextFromAIResponse,
} from "./ai-utils";
import { cleanPersonaPreamble, scrubSignals } from "./signals";

// Re-export shared utilities for backward compatibility
export { withRetry, safeParseJson, isLikelyTruncated, extractTextFromAIResponse, BudgetExceededError };

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



// NOTE: extractTextFromAIResponse, withRetry, isLikelyTruncated, safeParseJson
// are now imported from ./ai-utils and re-exported at the top of this file.
// This eliminates 150+ lines of duplicated utility code.

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
  "Yas Island": { lat: 24.4965, lng: 54.6036 },
  "جزيرة ياس": { lat: 24.4965, lng: 54.6036 },
  "Al Reem Island": { lat: 24.4943, lng: 54.4069 },
  "جزيرة الريم": { lat: 24.4943, lng: 54.4069 },
  "Saadiyat Island": { lat: 24.5401, lng: 54.4354 },
  "جزيرة السعديات": { lat: 24.5401, lng: 54.4354 },
  "Khalidiyah": { lat: 24.4755, lng: 54.3557 },
  "Al Raha Beach": { lat: 24.4365, lng: 54.5752 },
  "شاطئ الراحة": { lat: 24.4365, lng: 54.5752 },
  "Corniche": { lat: 24.4638, lng: 54.3444 },
  "Sharjah City": { lat: 25.3463, lng: 55.4209 },
  "Al Nahda": { lat: 25.3007, lng: 55.4177 },
  "Al Khan": { lat: 25.3531, lng: 55.3795 },
  "Ajman": { lat: 25.4052, lng: 55.5136 },
  "Ras Al Khaimah": { lat: 25.7953, lng: 55.9788 },
  "Fujairah": { lat: 25.1288, lng: 56.3265 },
  "Dubai": { lat: 25.2048, lng: 55.2708 },
  "Abu Dhabi": { lat: 24.4539, lng: 54.3773 },
  "Umm Al Quwain": { lat: 25.5647, lng: 55.5534 },
  "Al Hudayriyat Island": { lat: 24.4259, lng: 54.3235 },
  "جزيرة الحديريات": { lat: 24.4259, lng: 54.3235 },
  "Fahid Island": { lat: 24.5126, lng: 54.6080 },
  "جزيرة فاهد": { lat: 24.5126, lng: 54.6080 },
  "Yas Bay": { lat: 24.4578, lng: 54.5985 },
  "Al Maryah Island": { lat: 24.5020, lng: 54.3895 },
  "جزيرة المارية": { lat: 24.5020, lng: 54.3895 },
  "Abu Dhabi City": { lat: 24.4539, lng: 54.3773 },
  "مدينة أبوظبي": { lat: 24.4539, lng: 54.3773 }
};

export const GLOBAL_AREAS_COORDS: Record<string, { lat: number; lng: number }> = {
  // Saudi Arabia
  "Riyadh": { lat: 24.7136, lng: 46.6753 },
  "الرياض": { lat: 24.7136, lng: 46.6753 },
  "Jeddah": { lat: 21.5433, lng: 39.1728 },
  "جدة": { lat: 21.5433, lng: 39.1728 },
  "Saudi Arabia": { lat: 23.8859, lng: 45.0792 },
  "المملكة العربية السعودية": { lat: 23.8859, lng: 45.0792 },
  "السعودية": { lat: 23.8859, lng: 45.0792 },

  // UK & Europe
  "London": { lat: 51.5074, lng: -0.1278 },
  "لندن": { lat: 51.5074, lng: -0.1278 },
  "United Kingdom": { lat: 55.3781, lng: -3.4360 },
  "المملكة المتحدة": { lat: 55.3781, lng: -3.4360 },
  "بريطانيا": { lat: 55.3781, lng: -3.4360 },
  "Paris": { lat: 48.8566, lng: 2.3522 },
  "باريس": { lat: 48.8566, lng: 2.3522 },
  "France": { lat: 46.2276, lng: 2.2137 },
  "فرنسا": { lat: 46.2276, lng: 2.2137 },
  "Berlin": { lat: 52.5200, lng: 13.4050 },
  "برلين": { lat: 52.5200, lng: 13.4050 },
  "Germany": { lat: 51.1657, lng: 10.4515 },
  "ألمانيا": { lat: 51.1657, lng: 10.4515 },
  "Geneva": { lat: 46.2044, lng: 6.1432 },
  "جنيف": { lat: 46.2044, lng: 6.1432 },
  "Zurich": { lat: 47.3769, lng: 8.5417 },
  "زوريخ": { lat: 47.3769, lng: 8.5417 },
  "Munich": { lat: 48.1351, lng: 11.5820 },
  "ميونخ": { lat: 48.1351, lng: 11.5820 },
  "Switzerland": { lat: 46.8182, lng: 8.2275 },
  "سويسرا": { lat: 46.8182, lng: 8.2275 },

  // North America
  "New York": { lat: 40.7128, lng: -74.0060 },
  "نيويورك": { lat: 40.7128, lng: -74.0060 },
  "California": { lat: 36.7783, lng: -119.4179 },
  "كاليفورنيا": { lat: 36.7783, lng: -119.4179 },
  "United States": { lat: 37.0902, lng: -95.7129 },
  "الولايات المتحدة": { lat: 37.0902, lng: -95.7129 },
  "USA": { lat: 37.0902, lng: -95.7129 },
  "Canada": { lat: 56.1304, lng: -106.3468 },
  "كندا": { lat: 56.1304, lng: -106.3468 },
  "Toronto": { lat: 43.6532, lng: -79.3832 },
  "تورونتو": { lat: 43.6532, lng: -79.3832 },
  "Montreal": { lat: 45.5017, lng: -73.5673 },
  "مونتريال": { lat: 45.5017, lng: -73.5673 },
  "Vancouver": { lat: 49.2827, lng: -123.1207 },
  "فانكوفر": { lat: 49.2827, lng: -123.1207 },
  "Ottawa": { lat: 45.4215, lng: -75.6972 },
  "أوتاوا": { lat: 45.4215, lng: -75.6972 },
  "Edmonton": { lat: 53.5461, lng: -113.4938 },
  "إدمونتون": { lat: 53.5461, lng: -113.4938 },
  "Quebec": { lat: 46.8139, lng: -71.2082 },
  "كيبك": { lat: 46.8139, lng: -71.2082 },
  "Québec": { lat: 46.8139, lng: -71.2082 },

  // Gulf / Middle East
  "Kuwait": { lat: 29.3759, lng: 47.9774 },
  "الكويت": { lat: 29.3759, lng: 47.9774 },
  "Qatar": { lat: 25.3548, lng: 51.1849 },
  "قطر": { lat: 25.3548, lng: 51.1849 },
  "Doha": { lat: 25.2854, lng: 51.5310 },
  "الدوحة": { lat: 25.2854, lng: 51.5310 },
  "Bahrain": { lat: 26.0667, lng: 50.5577 },
  "البحرين": { lat: 26.0667, lng: 50.5577 },
  "Manama": { lat: 26.2285, lng: 50.5860 },
  "المنامة": { lat: 26.2285, lng: 50.5860 },
  "Oman": { lat: 21.5126, lng: 55.9233 },
  "عمان": { lat: 21.5126, lng: 55.9233 },
  "Muscat": { lat: 23.5859, lng: 58.4059 },
  "مسقط": { lat: 23.5859, lng: 58.4059 },
  "Egypt": { lat: 26.8206, lng: 30.8025 },
  "مصر": { lat: 26.8206, lng: 30.8025 },
  "Cairo": { lat: 30.0444, lng: 31.2357 },
  "القاهرة": { lat: 30.0444, lng: 31.2357 },
  "Lebanon": { lat: 33.8547, lng: 35.8623 },
  "لبنان": { lat: 33.8547, lng: 35.8623 },
  "Beirut": { lat: 33.8938, lng: 35.5018 },
  "بيروت": { lat: 33.8938, lng: 35.5018 },
  "Jordan": { lat: 30.5852, lng: 36.2384 },
  "الأردن": { lat: 30.5852, lng: 36.2384 },
  "Amman": { lat: 31.9539, lng: 35.9106 },
  "عمان (الأردن)": { lat: 31.9539, lng: 35.9106 },

  // Asia & Russia
  "India": { lat: 20.5937, lng: 78.9629 },
  "الهند": { lat: 20.5937, lng: 78.9629 },
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "بومباي": { lat: 19.0760, lng: 72.8777 },
  "Russia": { lat: 61.5240, lng: 105.3188 },
  "روسيا": { lat: 61.5240, lng: 105.3188 },
  "Moscow": { lat: 55.7558, lng: 37.6173 },
  "موسكو": { lat: 55.7558, lng: 37.6173 },
  "China": { lat: 35.8617, lng: 104.1954 },
  "الصين": { lat: 35.8617, lng: 104.1954 },
  "Turkey": { lat: 38.9637, lng: 35.2433 },
  "تركيا": { lat: 38.9637, lng: 35.2433 },
  "Istanbul": { lat: 41.0082, lng: 28.9784 },
  "إسطنبول": { lat: 41.0082, lng: 28.9784 },
  "Pakistan": { lat: 30.3753, lng: 69.3451 },
  "باكستان": { lat: 30.3753, lng: 69.3451 }
};

export function resolveCoords(location: string): { lat: number | null; lng: number | null } {
  const normalized = location?.trim() || "";
  
  // 1. Try UAE Areas first
  for (const [key, val] of Object.entries(UAE_AREAS_COORDS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }

  // 2. Try Global Areas next
  for (const [key, val] of Object.entries(GLOBAL_AREAS_COORDS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return val;
    }
  }

  return { lat: null, lng: null }; // Return null for unknown locations instead of defaulting to Abu Dhabi
}

export function normalizeLocation(loc: string): string {
  const normalized = (loc || "").trim();
  if (!normalized) return "";

  const lower = normalized.toLowerCase();

  for (const key of Object.keys(UAE_AREAS_COORDS)) {
    if (lower.includes(key.toLowerCase())) {
      return key; // Returns the exact area/island key to match the map configuration
    }
  }

  return normalized;
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

  const mappedSignals = signals.map(s => typeof s === 'string' ? s : String(s));
  const scrubbed = scrubSignals(mappedSignals);

  for (const sig of scrubbed) {
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
  const emails = Array.from(new Set((content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [])));
  const rawPhones = content.match(/(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,5}\)?[\s-]?)?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{0,4}/g) || [];
  const phones = Array.from(new Set(
    rawPhones
      .map((value) => normalizePhone(value))
      .filter((value) => value.length >= 8 && value.length <= 16 && !/^\d{8}$/.test(value)) // avoid 8-digit dates
  ));
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

/**
 * Generate text via Gemini — now delegates to the centralized AI gateway.
 * Maintains the same public signature for backward compatibility.
 *
 * @param taskType - Optional task type for right-sized token budgets and tracking.
 *                   Defaults to 'extraction' if not specified.
 */
async function generateGeminiText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  signal?: AbortSignal,
  taskType: AiTaskType = 'extraction',
  agentId?: string,
  skipBudgetCheck?: boolean
) {
  const result = await callGemini({
    systemPrompt,
    userPrompt,
    maxOutputTokens: maxTokens,
    signal,
    taskType,
    agentId,
    skipBudgetCheck,
  });

  return result.text;
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
- latitude (Number or null) - Approximate latitude coordinate of the location if international or specific, otherwise null
- longitude (Number or null) - Approximate longitude coordinate of the location if international or specific, otherwise null
- tier (1, 2, or 3) - REQUIRED: 1=Leadership/Founder, 2=Senior Management, 3=Professional
- score (0-100) - REQUIRED: Investment potential score
- email (String or null) - If visible on page
- phone (String or null) - If visible on page
- budgetMin (Number or null) - Estimated minimum budget if available
- budgetMax (Number or null) - Estimated maximum budget if available
- relocated (Boolean or null) - Mention of relocation or incoming move
- source (String) - "${scrapedData.name}"
- sourceType (String) - "${scrapedData.type}"
- signals (Array of 1-3 simple keyword tags like ["Founder", "Real Estate"], do NOT include narrative text or summaries)
- Do NOT generate a "persona" field at this stage. Keep persona as null.

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

Return a JSON array. ONLY include leads with complete name.
For any missing Arabic translations, translate from English context.
For missing location, default to "".
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
    "latitude": 24.4539,
    "longitude": 54.3773,
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
    4096,
    undefined,
    'extraction'
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
      4096,
      undefined,
      'extraction'
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
        lead.name && lead.company !== undefined && lead.company !== null && lead.role !== undefined && lead.role !== null && lead.tier && lead.score !== undefined && lead.location !== undefined && lead.location !== null
        && filterLeadByCriteria(lead, criteria)
        && verifyLeadInSource(lead.name, lead.nameAr, cleanedContent, lead.company, lead.companyAr)
      )
      .map((lead: any) => ({
        ...lead,
        signals: deduplicateSignals(lead.signals),
        persona: null
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
    - latitude (Number or null) - Approximate latitude coordinate of the location if international or specific, otherwise null
    - longitude (Number or null) - Approximate longitude coordinate of the location if international or specific, otherwise null
    - tier (1, 2, or 3)
    - score (0-100)
    - signals (Array of 1-3 simple keyword tags like ["Founder", "Real Estate"], do NOT include narrative text or summaries)
    - email (String or null)
    - phone (String or null)
    - budgetMin (Number or null)
    - budgetMax (Number or null)
    - relocated (Boolean or null)
    - Do NOT generate a "persona" field at this stage. Keep persona as null.

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
    2048,
    undefined,
    'extraction'
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
        signals: deduplicateSignals(lead.signals),
        persona: null
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
    512,
    undefined,
    'enrichment'
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
export async function generatePersonaAnalysis(lead: any, lang = "en", agentId?: string) {
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
CRITICAL: The lead's "location" field refers to their targeted investment area in the UAE, NOT their current residential location. They are a high-profile global/international investor who may be based anywhere in the world (e.g., Canada, Europe, etc.). Do NOT assume or write that they currently reside in the UAE or the target area unless explicitly confirmed by notes. Frame the persona around an international investor expanding their portfolio in the UAE.

CRITICAL PREAMBLE RULE:
Do NOT use generic, repetitive introductory templates or boilerplate prefixes (such as "Based on the available data...", "بناءً على تحليل البيانات المتاحة...", "Based on the lead's profile...", "The lead is a...", etc.). Jump directly into the specific motivational, behavioral, and profile characteristics. Ensure each response is highly customized and specific.

Focus on:
1. Investment Motivation (Why they buy in the UAE from abroad)
2. Risk Profile (Conservative vs Aggressive)
3. Lifestyle/Portfolio Alignment (What property suits them)
4. Decision Signals (UHNW, Executive, Business Owner)

At the very end of the paragraph, you MUST append a new line starting with:
- If English: "Outreach Advice: [1 sentence highly actionable recommendation for the agent]"
- If Arabic: "نصيحة التواصل: [توصية عملية ومحددة من جملة واحدة للوكيل العقاري]"

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
    1024,
    undefined,
    'persona',
    agentId
  );

  if (!content) {
    console.warn("Google Gemini AI analysis unavailable");
    return "AI Analysis Unavailable";
  }

  return cleanPersonaPreamble(content) || "AI Analysis Unavailable";
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

  const timeoutSignal = AbortSignal.timeout(60000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: combinedSignal
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

  const timeoutSignal = AbortSignal.timeout(60000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: combinedSignal
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

export async function extractProjectData(text: string): Promise<any[]> {
  const content = await generateGeminiText(
    `You are an expert Real Estate Data Extractor. 
    ABSOLUTE RULE: Extract ONLY real estate project and property data. DO NOT extract human names or leads.
    
    REQUIRED FIELDS FOR EACH PROJECT:
    - projectName (String): Name of the project/building.
    - location (String): Exactly matching areas like "Yas Island", "Saadiyat Island", "Al Reem Island", or specific UAE location name.
    - developer (String or null): Name of the developer if mentioned.
    - startingPrice (Number or null): Minimum price in AED (convert to plain number, remove symbols and commas, e.g. 1800000).
    - handoverDate (String or null): Expected delivery date (e.g., "Q4 2028").
    - propertyType (String or null): e.g. "Apartment", "Villa", "Townhouse".
    
    Return a JSON array of objects.`,
    `Extract projects from this text: ${text}`,
    2048,
    undefined,
    'projects'
  );

  return safeParseJson(content, []);
}

export { generateGeminiText };
