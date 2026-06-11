/**
 * lib/signals.ts
 *
 * Single source-of-truth for normalising the `signals` Json field from Prisma.
 *
 * MySQL stores this column as JSON. Prisma returns it typed as `Prisma.JsonValue`
 * which is `string | number | boolean | null | JsonObject | JsonArray`.
 * In practice the value may be:
 *   - string[]  → most common correct case
 *   - string    → e.g. if something serialised it twice, or CSV import wrote a plain string
 *   - { 0: "...", 1: "..." } → object with numeric keys (wrong write path)
 *   - null / undefined       → empty / missing
 *   - anything else          → defensive default
 *
 * `parseSignals()` ALWAYS returns `string[]`, NEVER throws.
 * `signalsToString()` returns a human-readable comma-separated string for AI prompts.
 */

// Prisma.JsonValue covers all legal JSON scalar/composite values
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// Blacklist patterns for internal technical indicators/signals
export const TECHNICAL_SIGNAL_BLACKLIST = [
  /manual[-_ ]?import/i,
  /scraper?/i,
  /scraping/i,
  /webhook/i,
  /ingestion/i,
  /source[-_ ]?config/i,
  /raw[-_ ]?data/i,
  /payload/i,
  /dummy/i,
  /mock/i,
  /placeholder/i,
  /internal/i,
  /technical/i,
  /metadata/i,
  /system/i,
  /cron/i,
  /watchdog/i,
  /run[-_ ]?id/i,
  /task[-_ ]?type/i,
  /api[-_ ]?endpoint/i,
  /db[-_ ]?writer/i,
  /test[-_ ]?lead/i,
];

/**
 * Filters out internal/technical indicators from a list of signals.
 */
export function scrubSignals(signals: string[]): string[] {
  return signals.filter(sig => {
    const clean = sig.trim();
    if (!clean) return false;
    const isTechnical = TECHNICAL_SIGNAL_BLACKLIST.some(pattern => pattern.test(clean));
    if (isTechnical) {
      console.log(`[Signal Scrubbing] Scrubbed technical signal: "${clean}"`);
    }
    return !isTechnical;
  });
}

/**
 * Safely parse the `signals` field from a Prisma Lead record.
 * Returns a clean `string[]` regardless of what Prisma returns.
 */
export function parseSignals(raw: unknown): string[] {
  try {
    // Null / undefined → empty
    if (raw === null || raw === undefined) return [];

    let parsed: string[] = [];

    // Already a proper array
    if (Array.isArray(raw)) {
      parsed = raw
        .map((item) => (typeof item === "string" ? item.trim() : String(item)))
        .filter(Boolean);
    }
    // Plain string — could be:
    //   a) JSON array  e.g.  '["UHNW","Investor"]'
    //   b) CSV string  e.g.  "UHNW, Investor"
    //   c) Single tag  e.g.  "UHNW"
    else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith("[")) {
        // Try JSON parse first
        try {
          const jsonParsed = JSON.parse(trimmed);
          if (Array.isArray(jsonParsed)) {
            parsed = jsonParsed
              .map((s) => (typeof s === "string" ? s.trim() : String(s)))
              .filter(Boolean);
          }
        } catch {
          // fall through to CSV split
        }
      }

      if (parsed.length === 0) {
        // CSV / single value
        parsed = trimmed
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    // Object with string/numeric keys (e.g. { "0": "UHNW", "1": "Investor" })
    else if (typeof raw === "object") {
      const values = Object.values(raw as Record<string, unknown>);
      parsed = values
        .map((v) => (typeof v === "string" ? v.trim() : String(v)))
        .filter(Boolean);
    }

    return scrubSignals(parsed);
  } catch {
    // Belt-and-suspenders — never crash the calling API
    return [];
  }
}

/**
 * Convert parsed signals to a concise string suitable for AI prompts.
 * Returns "None" when the array is empty so prompts remain readable.
 */
export function signalsToString(raw: unknown): string {
  const signals = parseSignals(raw);
  return signals.length > 0 ? signals.join(", ") : "None";
}

/**
 * Strips common repetitive preambles or boilerplate intros from LLM-generated personas.
 */
export function cleanPersonaPreamble(text: string | null | undefined): string | null {
  if (!text) return null;
  let cleaned = text.trim();

  // Remove common Arabic preambles
  const arabicPreambles = [
    /^بناءً على تحليل البيانات المتاحة،\s*/,
    /^بناءً على البيانات المتاحة،\s*/,
    /^بناءً على تحليل البيانات،\s*/,
    /^وفقًا للبيانات المتاحة،\s*/,
    /^تشير البيانات المتاحة إلى أن\s*/
  ];

  // Remove common English preambles
  const englishPreambles = [
    /^Based on the analysis of the available data,\s*/i,
    /^Based on the available data,\s*/i,
    /^Based on the analysis of available data,\s*/i,
    /^Based on the lead's profile,\s*/i,
    /^Based on the lead data,\s*/i,
    /^According to the available data,\s*/i,
    /^Based on the provided information,\s*/i
  ];

  for (const regex of [...arabicPreambles, ...englishPreambles]) {
    cleaned = cleaned.replace(regex, "");
  }

  // Capitalize first letter if English
  if (cleaned && /^[a-zA-Z]/.test(cleaned)) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned.trim() || null;
}
