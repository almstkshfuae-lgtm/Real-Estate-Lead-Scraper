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
  private static readonly HANDSHAKE_TIMEOUT_MS = 10_000;  // 10s — health checks
  private static readonly SCRAPE_TRIGGER_TIMEOUT_MS = 120_000; // 120s — scrape ack

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
    // Legacy timeout field kept for backwards compat; internal callers use the static constants
    this.timeout = config.timeout || ScraperClient.SCRAPE_TRIGGER_TIMEOUT_MS;
  }

  private createAbortController() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    return { controller, timeoutId };
  }

  /**
   * Check health of scraper service (fast 10s timeout)
   */
  async health(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ScraperClient.HANDSHAKE_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal
      });
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
   */
  async testConnection(): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ScraperClient.HANDSHAKE_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey
        }),
        signal: controller.signal
      });
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
      const response = await fetch(`${this.baseUrl}/sources`);
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
  async scrapeMultipleSources(sourceKeys: string[], webhookUrl?: string, runId?: string): Promise<ScraperResponse> {
    if (!sourceKeys || sourceKeys.length === 0) {
      throw new Error('At least one source key required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ScraperClient.SCRAPE_TRIGGER_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourceKeys,
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey,
          webhookUrl,
          runId
        }),
        signal: controller.signal
      });

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
      const response = await fetch(`${this.baseUrl}/scrape-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceKey,
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey
        }),
        signal: controller.signal
      });

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
      throw new Error("FATAL: SCRAPER_SECRET environment variable is missing!");
    }
    secret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
  }
  const proxyUrl = (await getSecret('proxyServiceUrl')) || process.env.PROXY_SERVICE_URL || undefined;
  const proxyApiKey = (await getSecret('proxyApiKey')) || process.env.PROXY_API_KEY || undefined;

  const baseUrl = configuredBaseUrl;

  return new ScraperClient({ baseUrl, secret, proxyUrl, proxyApiKey });
}

export function getScraperClient(): Promise<ScraperClient> {
  if (!scraperClientPromise) {
    scraperClientPromise = createScraperClient();
  }
  return scraperClientPromise;
}

export { ScraperClient };
export type { ScraperResponse, ScrapedContent, ScraperConfig };
