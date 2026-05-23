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

  constructor(config: ScraperConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:3002';
    this.secret = config.secret || 'scraper_secret_alpha_bravo';
    this.proxyUrl = config.proxyUrl;
    this.proxyApiKey = config.proxyApiKey;
    this.timeout = config.timeout || 30000;
  }

  private createAbortController() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    return { controller, timeoutId };
  }

  /**
   * Check health of scraper service
   */
  async health(): Promise<boolean> {
    const { controller, timeoutId } = this.createAbortController();
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
   * Check scraper service connection and optional proxy access
   */
  async testConnection(): Promise<boolean> {
    const { controller, timeoutId } = this.createAbortController();
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
   * Returns immediately - scraping happens in background
   */
  async scrapeMultipleSources(sourceKeys: string[]): Promise<ScraperResponse> {
    if (!sourceKeys || sourceKeys.length === 0) {
      throw new Error('At least one source key required');
    }

    const { controller, timeoutId } = this.createAbortController();
    try {
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourceKeys,
          secret: this.secret,
          proxyUrl: this.proxyUrl,
          proxyApiKey: this.proxyApiKey
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
  const baseUrl = (await getSecret('scraperServiceUrl')) || process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
  const secret = (await getSecret('scraperSecret')) || process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';
  const proxyUrl = (await getSecret('proxyServiceUrl')) || process.env.PROXY_SERVICE_URL || undefined;
  const proxyApiKey = (await getSecret('proxyApiKey')) || process.env.PROXY_API_KEY || undefined;

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
