/**
 * lib/ai-utils.ts
 *
 * Shared AI utilities — single source of truth for retry logic, JSON parsing,
 * truncation detection, response extraction, and cost estimation.
 *
 * Used by both lib/ai-gateway.ts (Next.js) and referenced by scraper-service patterns.
 */

// ─── Retry with Exponential Backoff ──────────────────────────────────────────

/**
 * Retry a function with exponential backoff on rate-limit or transient errors.
 * Handles Gemini 429 (Too Many Requests) and 503 (Service Unavailable).
 */
export async function withRetry<T>(
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

      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(
        `[AI] Rate-limited (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('[AI] withRetry: max attempts exceeded — this line should be unreachable');
}

// ─── Truncation Detection ────────────────────────────────────────────────────

/**
 * Detect whether a Gemini JSON response was likely truncated due to maxOutputTokens limit.
 * Truncated responses end mid-structure (no closing ] or }) and are non-trivially long.
 */
export function isLikelyTruncated(text: string): boolean {
  if (!text || text.length < 50) return false;
  const trimmed = text.trim();
  const lastChar = trimmed[trimmed.length - 1];
  return lastChar !== ']' && lastChar !== '}';
}

// ─── Safe JSON Parsing ───────────────────────────────────────────────────────

export function safeParseJson(text: string, fallback: any = []): any {
  if (!text) return fallback;

  let cleanText = text.trim();

  // 1. Remove markdown code blocks if present
  if (cleanText.includes("```")) {
    const matches = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (matches && matches[1]) {
      cleanText = matches[1].trim();
    }
  }

  // 2. Locate JSON array or object boundaries
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

  // 3. Strip invalid ASCII control characters
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    if (isLikelyTruncated(text)) {
      console.warn('[AI] TRUNCATION DETECTED — response cut off before closing bracket.', {
        inputLength: text.length,
        lastChars: text.slice(-120),
        firstChars: text.slice(0, 120)
      });
    } else {
      console.error('[AI] JSON Parse failed for raw text:', text.substring(0, 500));
    }

    try {
      const fixedJsonStr = jsonStr
        .replace(/,\s*\]/g, ']')
        .replace(/,\s*\}/g, '}')
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
      return JSON.parse(fixedJsonStr);
    } catch (innerError) {
      console.error('[AI] Secondary JSON parsing recovery failed:', innerError);
      if (fallback === null) return null;
      throw new Error("AI JSON Parsing Failed: Gemini returned an invalid or incomplete JSON response.");
    }
  }
}

// ─── Gemini Response Text Extraction ─────────────────────────────────────────

export function extractTextFromAIResponse(response: any): string {
  if (!response) return "";

  const candidate = response?.predictions?.[0] || response?.candidates?.[0] || response?.choices?.[0] || response?.output?.[0] || response?.output || response;
  let contents = candidate?.message?.content || candidate?.content || candidate?.output || candidate?.text || candidate;

  if (!contents) return "";

  if (typeof contents === "object" && Array.isArray(contents.parts)) {
    return contents.parts.map((part: any) => part.text || "").filter(Boolean).join("");
  }

  if (typeof candidate === "object" && Array.isArray(candidate.parts)) {
    return candidate.parts.map((part: any) => part.text || "").filter(Boolean).join("");
  }

  if (Array.isArray(contents)) {
    return contents.map((item: any) => (typeof item === "string" ? item : item?.text || "")).filter(Boolean).join("\n");
  }

  if (typeof contents === "string") return contents;

  if (typeof contents === "object") {
    return Object.values(contents).map((value: any) => (typeof value === "string" ? value : "")).filter(Boolean).join("\n");
  }

  return "";
}

// ─── Token Usage Extraction ──────────────────────────────────────────────────

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extract token usage metadata from a Gemini API response.
 * Gemini returns usageMetadata with promptTokenCount and candidatesTokenCount.
 */
export function extractTokenUsage(response: any): TokenUsage {
  const usage = response?.usageMetadata;
  if (!usage) {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const promptTokens = usage.promptTokenCount || 0;
  const completionTokens = usage.candidatesTokenCount || 0;
  const totalTokens = usage.totalTokenCount || (promptTokens + completionTokens);

  return { promptTokens, completionTokens, totalTokens };
}

// ─── Cost Estimation ─────────────────────────────────────────────────────────

/**
 * Gemini pricing (approximate, USD per 1M tokens) as of 2025/2026.
 * gemini-2.5-flash is the primary model used.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.15, output: 0.60 },      // $0.15/1M input, $0.60/1M output
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-1.5-pro':   { input: 1.25, output: 5.00 },
  'gemini-2.5-pro':   { input: 1.25, output: 10.00 },
};

/**
 * Estimate cost in USD for a Gemini API call.
 */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Normalize model name — strip version suffixes for matching
  const normalizedModel = model.toLowerCase().trim();
  let pricing = MODEL_PRICING[normalizedModel];
  
  if (!pricing) {
    // Fuzzy match: find the longest matching key
    for (const [key, val] of Object.entries(MODEL_PRICING)) {
      if (normalizedModel.includes(key) || key.includes(normalizedModel)) {
        pricing = val;
        break;
      }
    }
  }

  // Default to flash pricing if no match found
  if (!pricing) {
    pricing = MODEL_PRICING['gemini-2.5-flash'];
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}

// ─── Default Token Budgets Per Task ──────────────────────────────────────────

export const TASK_TOKEN_DEFAULTS: Record<string, number> = {
  pitch: 512,
  score: 256,
  signals: 512,
  chat: 2048,
  extraction: 4096,
  persona: 1024,
  projects: 2048,
  enrichment: 512,
};

/**
 * Get the right-sized maxOutputTokens for a given task type.
 */
export function getMaxOutputTokens(taskType: string, override?: number): number {
  if (override && override > 0) return override;
  return TASK_TOKEN_DEFAULTS[taskType] || 1024;
}
