/**
 * lib/ai-json.ts
 *
 * Robust JSON extraction from raw LLM (Gemini/OpenAI) text output.
 *
 * Problem with the naïve regex /\{[\s\S]*\}/:
 *   It is GREEDY — it matches from the first '{' to the LAST '}' in the entire
 *   output.  If the model wraps reasoning text in braces, or emits two JSON blocks,
 *   or uses curly braces inside a "reasoning" string value, the regex over-captures
 *   and produces invalid JSON that fails JSON.parse, causing repeated 502 errors.
 *
 * Solution — a 3-layer cascade:
 *   1. Strip common markdown code fences (```json … ```, ``` … ```)
 *   2. Try JSON.parse on the stripped text directly (fast path for clean responses)
 *   3. If that fails, run a character-level balanced-brace scan that finds the FIRST
 *      complete, balanced {...} block and tries to parse only that block.
 *      This is non-greedy: it stops as soon as depth returns to 0, ignoring any
 *      trailing text/braces that follow.
 *   4. If all attempts fail, throw a typed ParseError so callers can return 502.
 */

export class AIJsonParseError extends Error {
  public readonly rawSnippet: string;
  constructor(message: string, raw: string) {
    super(message);
    this.name = "AIJsonParseError";
    // Keep a safe 300-char snippet for logging — never log full AI output in prod
    this.rawSnippet = raw.slice(0, 300);
  }
}

/**
 * Remove markdown code fences and trim whitespace.
 * Handles: ```json\n...\n```, ```\n...\n```, and bare content.
 */
function stripMarkdownFences(text: string): string {
  // Remove opening fence with optional language tag
  let stripped = text.replace(/^```(?:json|JSON)?\s*/m, "");
  // Remove closing fence
  stripped = stripped.replace(/\s*```\s*$/m, "");
  return stripped.trim();
}

/**
 * Find the first complete, balanced JSON object in a string.
 *
 * Walks the string char-by-char tracking brace depth. Stops at the first
 * position where depth returns to 0 after having opened at least once.
 * Handles '{' / '}' inside strings (both double-quoted and escaped) safely.
 *
 * Returns null if no balanced block is found.
 */
function extractFirstBalancedObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    // Only count braces outside of string values
    if (!inString) {
      if (ch === "{") {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

/**
 * Parse JSON from an LLM text response robustly.
 *
 * @param raw   - The full text string returned by the AI model
 * @returns     - A parsed JavaScript object/array
 * @throws      - AIJsonParseError if all parsing strategies fail
 */
export function parseAIJson<T = unknown>(raw: string): T {
  if (!raw || !raw.trim()) {
    throw new AIJsonParseError("Empty AI response", raw);
  }

  const cleaned = stripMarkdownFences(raw);

  // Layer 1: direct parse on stripped text (covers clean JSON-only responses)
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // fall through
  }

  // Layer 2: balanced-brace scan — non-greedy, finds first complete object
  const block = extractFirstBalancedObject(cleaned);
  if (block) {
    try {
      return JSON.parse(block) as T;
    } catch {
      // fall through — the block itself is malformed (e.g. trailing comma)
    }
  }

  // Layer 3: attempt on the raw string unchanged (handles responses with no fences)
  try {
    return JSON.parse(raw) as T;
  } catch {
    // fall through
  }

  // All layers failed
  throw new AIJsonParseError(
    `Could not extract valid JSON from AI response after 3 parse attempts. Snippet: "${raw.slice(0, 120).replace(/\n/g, " ")}..."`,
    raw
  );
}
