/**
 * lib/ai-gateway.ts
 *
 * Centralized Gemini API gateway — ALL AI calls flow through here.
 *
 * Responsibilities:
 *  1. Single fetch logic for generateContent + streamGenerateContent
 *  2. Automatic input truncation guard
 *  3. Token usage tracking → AiUsageLog table
 *  4. Cost estimation per call
 *  5. Daily budget enforcement (configurable cap)
 *  6. Built-in retry with exponential backoff
 *  7. Right-sized maxOutputTokens per task type
 */

import { getAIConfig } from "./ai";
import {
  withRetry,
  extractTextFromAIResponse,
  extractTokenUsage,
  estimateCost,
  getMaxOutputTokens,
  type TokenUsage,
} from "./ai-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AiTaskType = 'pitch' | 'score' | 'signals' | 'chat' | 'extraction' | 'persona' | 'projects' | 'enrichment';

export interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  maxInputChars?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  signal?: AbortSignal;
  taskType: AiTaskType;
  agentId?: string;
  skipBudgetCheck?: boolean;
}

export interface GeminiCallResult {
  text: string;
  usage: TokenUsage;
  estimatedCostUsd: number;
  truncatedInput: boolean;
  durationMs: number;
  model: string;
}

// ─── Budget Check ────────────────────────────────────────────────────────────

const DEFAULT_DAILY_BUDGET_USD = 5.0;

/**
 * Check if the daily AI budget has been exceeded.
 * Returns { exceeded, currentSpend, limit }.
 */
export async function checkDailyBudget(): Promise<{ exceeded: boolean; currentSpend: number; limit: number }> {
  try {
    // Dynamic import to avoid circular dependency and build-time issues
    const { default: prisma } = await import("./prisma");

    // Get budget from admin preferences, fallback to env var, then default
    let budgetLimit = DEFAULT_DAILY_BUDGET_USD;
    const envBudget = process.env.AI_DAILY_BUDGET_USD;
    if (envBudget) {
      const parsed = parseFloat(envBudget);
      if (!isNaN(parsed) && parsed > 0) budgetLimit = parsed;
    }

    try {
      const admin = await prisma.user.findFirst({
        where: {
          role: {
            in: ["admin", "ADMIN"]
          }
        },
        select: { preferences: true },
      });
      if (admin?.preferences) {
        const prefs = typeof admin.preferences === "string" ? JSON.parse(admin.preferences) : admin.preferences;
        const configuredBudget = prefs.integrations?.aiDailyBudgetUsd;
        if (configuredBudget !== undefined && configuredBudget !== null) {
          const parsed = parseFloat(String(configuredBudget));
          if (!isNaN(parsed) && parsed > 0) budgetLimit = parsed;
        }
      }
    } catch (err) {
      console.error("[AI Gateway] Database error while fetching preferences:", err);
      throw err;
    }

    // Sum today's spend
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let currentSpend = 0;
    try {
      const result = await prisma.aiUsageLog.aggregate({
        _sum: { estimatedCostUsd: true },
        where: { createdAt: { gte: todayStart } },
      });
      currentSpend = result._sum.estimatedCostUsd || 0;
    } catch (err) {
      console.error("[AI Gateway] Database error while aggregating AI usage:", err);
      throw err;
    }

    return {
      exceeded: currentSpend >= budgetLimit,
      currentSpend,
      limit: budgetLimit,
    };
  } catch (err) {
    console.error("[AI Gateway] Error checking daily budget:", err);
    throw new Error(`Failed to verify AI daily budget: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ─── Usage Logging ───────────────────────────────────────────────────────────

async function logUsage(opts: {
  taskType: string;
  model: string;
  usage: TokenUsage;
  estimatedCostUsd: number;
  inputChars: number;
  truncated: boolean;
  success: boolean;
  errorMessage?: string;
  agentId?: string;
  durationMs: number;
}): Promise<void> {
  try {
    const { default: prisma } = await import("./prisma");
    await prisma.aiUsageLog.create({
      data: {
        taskType: opts.taskType,
        model: opts.model,
        promptTokens: opts.usage.promptTokens,
        completionTokens: opts.usage.completionTokens,
        totalTokens: opts.usage.totalTokens,
        estimatedCostUsd: opts.estimatedCostUsd,
        inputChars: opts.inputChars,
        truncated: opts.truncated,
        success: opts.success,
        errorMessage: opts.errorMessage || null,
        agentId: opts.agentId || null,
        durationMs: opts.durationMs,
      },
    });
  } catch (err) {
    // Non-critical — don't fail the AI call if logging fails
    console.error("[AI Gateway] Failed to log usage:", (err as Error).message);
  }
}

// ─── Core Gateway ────────────────────────────────────────────────────────────

/**
 * Central Gemini API call — all non-streaming AI requests go through here.
 */
export async function callGemini(opts: GeminiCallOptions): Promise<GeminiCallResult> {
  const config = await getAIConfig();
  if (!config) {
    throw new Error("No AI provider configured. Set GOOGLE_AI_API_KEY.");
  }

  // Budget check
  if (!opts.skipBudgetCheck) {
    const budget = await checkDailyBudget();
    if (budget.exceeded) {
      throw new BudgetExceededError(
        `Daily AI budget exceeded ($${budget.currentSpend.toFixed(4)} / $${budget.limit.toFixed(2)}). ` +
        `Adjust in Settings → Integrations.`,
        budget.currentSpend,
        budget.limit
      );
    }
  }

  const maxOutputTokens = getMaxOutputTokens(opts.taskType, opts.maxOutputTokens);
  const maxInputChars = opts.maxInputChars ?? 50000;
  const temperature = opts.temperature ?? 0.0;
  const topP = opts.topP ?? 0.95;
  const topK = opts.topK ?? 40;

  // Input truncation guard
  let combinedPrompt = `${opts.systemPrompt}\n\n${opts.userPrompt}`;
  let truncatedInput = false;
  if (combinedPrompt.length > maxInputChars) {
    combinedPrompt = combinedPrompt.substring(0, maxInputChars) + "\n... [Truncated due to context window limits]";
    truncatedInput = true;
    console.warn(`[AI Gateway] Input truncated from ${opts.systemPrompt.length + opts.userPrompt.length} to ${maxInputChars} chars for task: ${opts.taskType}`);
  }

  const inputChars = combinedPrompt.length;
  const isProjectBased = Boolean(config.projectId);

  const body = isProjectBased
    ? {
        instances: [{ content: combinedPrompt }],
        parameters: { temperature, maxOutputTokens, topP, topK },
      }
    : {
        contents: [{ parts: [{ text: combinedPrompt }] }],
        generationConfig: { temperature, maxOutputTokens, topP, topK },
      };

  const endpoint = isProjectBased
    ? `https://us-central1-aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`
    : `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const startTime = Date.now();
  const timeoutSignal = AbortSignal.timeout(30000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeoutSignal]) : timeoutSignal;

  try {
    const result = await withRetry(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          console.error('[AI Gateway] Gemini API error', { status: response.status, body: errorText.substring(0, 1000) });
        } catch {}
        if (response.status === 400 && errorText.includes("API key not valid")) {
          throw new Error("Gemini API key invalid or unauthorized. Verify GOOGLE_AI_API_KEY and project settings.");
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Gemini authentication error ${response.status}: ${errorText}`);
        }
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      return response.json();
    }, 8, 3000);

    const durationMs = Date.now() - startTime;
    const text = extractTextFromAIResponse(result) || "";
    const usage = extractTokenUsage(result);
    const costUsd = estimateCost(config.model, usage.promptTokens, usage.completionTokens);

    // Log usage and await to ensure it is written before Vercel terminates the execution context
    await logUsage({
      taskType: opts.taskType,
      model: config.model,
      usage,
      estimatedCostUsd: costUsd,
      inputChars,
      truncated: truncatedInput,
      success: true,
      agentId: opts.agentId,
      durationMs,
    });

    return {
      text,
      usage,
      estimatedCostUsd: costUsd,
      truncatedInput,
      durationMs,
      model: config.model,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;

    // Log failed calls too and await to ensure it is written before Vercel terminates the execution context
    await logUsage({
      taskType: opts.taskType,
      model: config.model,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      estimatedCostUsd: 0,
      inputChars,
      truncated: truncatedInput,
      success: false,
      errorMessage: err.message?.substring(0, 1000),
      agentId: opts.agentId,
      durationMs,
    });

    throw err;
  }
}

// ─── Budget Exceeded Error ───────────────────────────────────────────────────

export class BudgetExceededError extends Error {
  public readonly currentSpend: number;
  public readonly limit: number;

  constructor(message: string, currentSpend: number, limit: number) {
    super(message);
    this.name = "BudgetExceededError";
    this.currentSpend = currentSpend;
    this.limit = limit;
  }
}
