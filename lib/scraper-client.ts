/**
 * Scraper Service Client
 * Interfaces with the Playwright-based Scraper Microservice
 * Handles communication with the internal scraping engine
 */

interface ScraperConfig {
  baseUrl: string;
  secret: string;
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
  private timeout: number;

  constructor(config: ScraperConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:3002';
    this.secret = config.secret || 'scraper_secret_alpha_bravo';
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
          secret: this.secret
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
          secret: this.secret
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

// Singleton instance
let scraperClient: ScraperClient | null = null;

export function getScraperClient(): ScraperClient {
  if (!scraperClient) {
    const baseUrl = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
    const secret = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';
    scraperClient = new ScraperClient({ baseUrl, secret });
  }
  return scraperClient;
}

export { ScraperClient, ScraperResponse, ScrapedContent, ScraperConfig };
