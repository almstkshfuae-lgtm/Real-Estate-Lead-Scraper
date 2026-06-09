/**
 * Scraper Service Client
 * Interfaces with the Playwright-based Scraper Microservice
 * Handles communication with the internal scraping engine
 */

import { getSecret } from "./secrets";

interface ScraperConfig {
  baseUrl: string;
  secret: string;
  proxyUrl?: string;
  proxyApiKey?: string;
  timeout?: number;
  handshakeTimeout?: number;
  triggerTimeout?: number;
}

interface ScrapedContent {
  url: string;
  name: string;
  type: string;
  signals: string[];
  title: string;
  description: string;
  content: string;
  contentLength: number;
  pagesScraped: number;
}

interface ScraperResponse {
  message: string;
  status: string;
  sources: string[];
}

class ScraperClient {
  private baseUrl: string;
  private secret: string;
  private proxyUrl?: string;
  private proxyApiKey?: string;
  private timeout: number;
  private handshakeTimeout: number;
  private triggerTimeout: number;

  /**
   * TIMEOUT RATIONALE:
   * - Health / test-connection: 10s (fast handshake only)
   * - scrapeMultipleSources: 120s (scraper returns immediately, this covers the initial HTTP ack)
   * The scraper-service processes jobs asynchronously in background and delivers results
   * via webhook — so the 120s window only needs to cover the job-acceptance handshake,
   * not the full scraping duration.
   * DO NOT lower below 60s; the /scrape endpoint may take up to 45s to respond
   * if source verification checks are slow.
   */
  private static readonly DEFAULT_HANDSHAKE_TIMEOUT_MS = 10_000;  // 10s — health checks
  private static readonly DEFAULT_SCRAPE_TRIGGER_TIMEOUT_MS = 15_000; // 15s — scraper responds immediately with queued ack

  constructor(config: ScraperConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:3002';
    let secret = config.secret;
    if (!secret || secret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error("FATAL: Scraper secret configuration is missing in production!");
      }
      secret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
    }
    this.secret = secret;
    this.proxyUrl = config.proxyUrl;
    this.proxyApiKey = config.proxyApiKey;

    // Resolve handshake timeout from config, env variable, or static default
    this.handshakeTimeout = config.handshakeTimeout ||
      (process.env.SCRAPER_HANDSHAKE_TIMEOUT_MS ? parseInt(process.env.SCRAPER_HANDSHAKE_TIMEOUT_MS, 10) : ScraperClient.DEFAULT_HANDSHAKE_TIMEOUT_MS);

    // Resolve trigger timeout from config, env variable, or static default
    this.triggerTimeout = config.triggerTimeout || config.timeout ||
      (process.env.SCRAPER_TRIGGER_TIMEOUT_MS ? parseInt(process.env.SCRAPER_TRIGGER_TIMEOUT_MS, 10) : ScraperClient.DEFAULT_SCRAPE_TRIGGER_TIMEOUT_MS);

    // Keep legacy timeout field in sync for backward compatibility
    this.timeout = this.triggerTimeout;
  }

  private createAbortController() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    return { controller, timeoutId };
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        parsed.password = 'REDACTED';
      }
      if (parsed.username) {
        parsed.username = 'REDACTED';
      }
      return parsed.toString();
    } catch {
      return url.replace(/([a-zA-Z0-9+.-]+:\/\/)?([^:@\s]+):([^@\s]+)@/g, "$1[REDACTED]:[REDACTED]@");
    }
  }

  /**
   * Internal fetch wrapper with robust exponential backoff retry logic and AbortSignal support.
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 1000): Promise<Response> {
    const signal = options.signal;
    const cleanUrl = this.sanitizeUrl(url);

    try {
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const response = await fetch(url, options);

      // Only retry on transient 5xx server errors and 429 rate limits
      if (!response.ok && (response.status >= 500 || response.status === 429)) {
        if (retries > 0 && !signal?.aborted) {
          console.warn(`[ScraperClient] Request to ${cleanUrl} failed with status ${response.status}. Retrying in ${delayMs}ms... (${retries} retries left)`);
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, delayMs);
            if (signal) {
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            }
          });

          return this.fetchWithRetry(url, options, retries - 1, delayMs * 2);
        }
      }
      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error;
      }
      if (retries > 0 && !signal?.aborted) {
        console.warn(`[ScraperClient] Request to ${cleanUrl} failed with error: ${error.message || error}. Retrying in ${delayMs}ms... (${retries} retries left)`);
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(resolve, delayMs);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }
        });

        return this.fetchWithRetry(url, options, retries - 1, delayMs * 2);
      }
      throw error;
    }
  }

  /**
   * Check health of scraper service (fast 10s timeout)
   */
  async health(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.handshakeTimeout);
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/health`, {
        signal: controller.signal
      }, 2, 500); // 2 retries, 500ms initial delay
      return response.ok;
    } catch (error) {
      console.error('Scraper health check failed:', error);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check scraper service connection and optional proxy access (fast 10s timeout)
   * Falls back to GET /health if /test-connection returns 404 (old scraper deployment)
   */
  async testConnection(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.handshakeTimeout);
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey
        }),
        signal: controller.signal
      }, 2, 500); // 2 retries, 500ms initial delay

      // If route doesn't exist yet (old deployment), fall back to /health
      if (response.status === 404) {
        console.warn('[ScraperClient] /test-connection returned 404 — falling back to /health');
        const healthRes = await this.fetchWithRetry(`${this.baseUrl}/health`, { signal: controller.signal }, 2, 500);
        return healthRes.ok;
      }

      return response.ok;
    } catch (error) {
      console.error('Scraper connection test failed:', error);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get available HNWI sources
   */
  async getAvailableSources(): Promise<any[]> {
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/sources`, {}, 3, 1000);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.sources || [];
    } catch (error) {
      console.error('Failed to fetch available sources:', error);
      return [];
    }
  }

  /**
   * Trigger scraping of multiple HNWI sources
   * Returns immediately — scraping happens in background on Railway.
   * Uses 120s timeout to cover slow source verification checks.
   */
  async scrapeMultipleSources(sourceKeys: string[], webhookUrl?: string, runId?: string, criteria?: any): Promise<ScraperResponse> {
    if (!sourceKeys || sourceKeys.length === 0) {
      throw new Error('At least one source key required');
    }

    const uaeComplianceModeVal = await getSecret('uaeComplianceMode');
    const uaeComplianceMode = uaeComplianceModeVal === 'true';
    const globalRateLimitDelayVal = await getSecret('globalRateLimitDelay');
    const globalRateLimitDelay = globalRateLimitDelayVal ? parseInt(globalRateLimitDelayVal, 10) : 3000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.triggerTimeout);
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourceKeys,
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey,
          webhookUrl,
          runId,
          criteria,
          uaeComplianceMode,
          globalRateLimitDelay
        }),
        signal: controller.signal
      }, 3, 1000); // 3 retries, 1000ms delay

      if (!response.ok) {
        throw new Error(`Scraper service error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to trigger scraping:', error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Scrape a single source and get content synchronously
   * Waits for scraping to complete
   */
  async scrapeSourceSync(sourceKey: string): Promise<ScrapedContent> {
    const { controller, timeoutId } = this.createAbortController();
    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/scrape-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey,
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey
        }),
        signal: controller.signal
      }, 3, 1000);

      if (!response.ok) {
        throw new Error(`Scraper service error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error(`Failed to scrape source ${sourceKey}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// Singleton instance promise
let scraperClientPromise: Promise<ScraperClient> | null = null;

async function createScraperClient(): Promise<ScraperClient> {
  const configuredBaseUrl = (await getSecret('scraperServiceUrl')) || process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
  const defaultLocalUrl = 'http://localhost:3002';
  let secret = (await getSecret('scraperSecret')) || process.env.SCRAPER_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: SCRAPER_SECRET is missing in production!");
    }
    console.warn("WARNING: SCRAPER_SECRET is missing or empty. Using default fallback secret.");
    secret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
  }
  const proxyUrl = (await getSecret('proxyServiceUrl')) || process.env.PROXY_SERVICE_URL || undefined;
  const proxyApiKey = (await getSecret('proxyApiKey')) || process.env.PROXY_API_KEY || undefined;

  const baseUrl = configuredBaseUrl;

  return new ScraperClient({ baseUrl, secret, proxyUrl, proxyApiKey });
}

export function getScraperClient(): Promise<ScraperClient> {
  if (!scraperClientPromise) {
    scraperClientPromise = createScraperClient().catch(err => {
      scraperClientPromise = null;
      throw err;
    });
  }
  return scraperClientPromise;
}

export function getWebhookUrl(requestOrigin: string): string {
  // 1. Explicit full webhook URL override
  if (process.env.WEBHOOK_URL) {
    if (process.env.WEBHOOK_URL.includes('/api/scrape/webhook')) {
      return process.env.WEBHOOK_URL;
    }
    // If it's just the base URL, append the path
    const base = process.env.WEBHOOK_URL.replace(/\/$/, '');
    return `${base}/api/scrape/webhook`;
  }

  // 2. Base URL override
  let origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || requestOrigin;

  // 3. Safe localhost/loopback to 127.0.0.1 replacement preserving protocol and port
  try {
    const urlObj = new URL(origin);
    const hostname = urlObj.hostname;
    if (hostname === 'localhost' || hostname === '[::1]' || hostname === '0.0.0.0' || hostname === '::1') {
      urlObj.hostname = '127.0.0.1';
      origin = urlObj.origin;
    }
  } catch (e) {
    // Basic fallback replacement if URL parsing fails
    if (origin.includes('localhost')) {
      origin = origin.replace('localhost', '127.0.0.1');
    } else if (origin.includes('[::1]')) {
      origin = origin.replace('[::1]', '127.0.0.1');
    } else if (origin.includes('::1')) {
      origin = origin.replace('::1', '127.0.0.1');
    }
  }

  return `${origin}/api/scrape/webhook`;
}

export { ScraperClient };
export type { ScraperResponse, ScrapedContent, ScraperConfig };
