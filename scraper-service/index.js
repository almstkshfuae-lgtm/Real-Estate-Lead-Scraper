import express from 'express';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SCRAPER_SOURCES } from './default-sources.js';
import { verifySourceCompletePipeline } from './verification-pipeline.js';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const SECRET = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';

/**
 * Proxy Configuration for Oxylabs
 * Rotating residential proxies to bypass Cloudflare and anti-bot detection
 */
const PROXY_CONFIG = {
  enabled: process.env.USE_PROXY === 'true' || true,
  provider: 'oxylabs',
  // Format: socks5://username:password@proxy:port
  // Or: http://username:password@proxy:port
  getProxyUrl: () => {
    if (!process.env.OXYLABS_PROXY_URL) {
      console.warn('⚠️  OXYLABS_PROXY_URL not set - proceeding without proxy');
      return null;
    }
    return process.env.OXYLABS_PROXY_URL;
  }
};

function getRandomDelay(minMs = 1000, maxMs = 4000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function simulateHumanBrowsing(page) {
  const viewport = page.viewportSize() || { width: 1280, height: 800 };
  const steps = Math.max(2, Math.floor(Math.random() * 4));
  for (let i = 0; i < steps; i++) {
    const x = Math.floor(Math.random() * viewport.width);
    const y = Math.floor(Math.random() * viewport.height);
    await page.mouse.move(x, y, { steps: 5 });
    await page.waitForTimeout(getRandomDelay(500, 1200));
    const scrollY = Math.floor(viewport.height * (0.25 + Math.random() * 0.5));
    await page.evaluate((y) => window.scrollBy(0, y), scrollY);
    await page.waitForTimeout(getRandomDelay(500, 1200));
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await page.waitForTimeout(getRandomDelay(500, 1200));
}

function extractCleanTextFromHTML(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, header, footer, nav, aside, form, svg, canvas').remove();
  const text = $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\u00A0/g, ' ')
    .trim();
}

async function detectAndClickLoadMore(page, source) {
  const loadMoreSelectors = [
    'button:has-text("Load More")',
    'button:has-text("Show More")',
    'a:has-text("Load More")',
    'a:has-text("Show More")',
    'button:has-text("More")',
    'a:has-text("More")'
  ];

  for (const selector of [...(source.navigationSelectors.pagination || []), ...loadMoreSelectors]) {
    try {
      const element = await page.locator(selector).first();
      if (await element.isVisible()) {
        await element.scrollIntoViewIfNeeded();
        await page.waitForTimeout(getRandomDelay(800, 1800));
        await element.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        return true;
      }
    } catch (e) {
      // ignore missing selectors
    }
  }

  return false;
}

async function getSourceConfigMap() {
  const configs = await prisma.sourceConfig.findMany({ where: { active: true } });
  if (!configs || configs.length === 0) {
    await seedDefaultSources();
    return getSourceConfigMap();
  }

  return configs.reduce((acc, config) => {
    acc[config.key] = config;
    return acc;
  }, {});
}

async function seedDefaultSources() {
  for (const source of DEFAULT_SCRAPER_SOURCES) {
    await prisma.sourceConfig.upsert({
      where: { key: source.key },
      update: {
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: source.navigationSelectors,
        contentSelectors: source.contentSelectors,
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: true
      },
      create: {
        key: source.key,
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: source.navigationSelectors,
        contentSelectors: source.contentSelectors,
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: true
      }
    });
  }
}

// Source configs are loaded from Prisma at runtime.
const HNWI_SOURCES = {};

app.post('/scrape', async (req, res) => {
  const { sources, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'sources array required' });
  }

  console.log('Received scrape request for sources:', sources);

  // Background processing - return immediately
  (async () => {
    try {
      await scrapeMultipleSources(sources);
    } catch (error) {
      console.error('Scrape pipeline error:', error);
    }
  })().catch(console.error);

  res.json({ 
    message: 'Scrape job started', 
    status: 'processing',
    sources: sources
  });
});

app.post('/scrape-source', async (req, res) => {
  const { sourceKey, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'Invalid source key' });
  }

  try {
    const sourceMap = await getSourceConfigMap();
    if (!sourceMap[sourceKey]) {
      return res.status(400).json({ error: 'Invalid source key' });
    }

    const content = await scrapeSource(sourceKey);
    res.json({ 
      source: sourceKey,
      content: content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Source scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Scrape a single source with deep crawling, pagination, and DOM interaction
 * Supports multi-page traversal and content extraction
 */
async function scrapeSourceWithBrowser(browser, source) {
  const proxyUrl = PROXY_CONFIG.getProxyUrl();
  
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  };

  // Add proxy if configured
  if (proxyUrl) {
    contextOptions.proxy = { server: proxyUrl };
    console.log(`🔒 Using Oxylabs proxy for ${sourceKey}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const allContent = [];
  const visitedUrls = new Set();

  try {
    await page.goto(source.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await simulateHumanBrowsing(page);
    await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, source.maxPages || 5);

    // Combine all scraped content
    const combinedContent = allContent.join('\n\n---PAGE BREAK---\n\n');

    // Get page metadata
    const metadata = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    }));

    return {
      url: source.url,
      name: source.name,
      type: source.type,
      signals: source.signals,
      title: metadata.title,
      description: metadata.description,
      content: combinedContent,
      contentLength: combinedContent.length,
      pagesScraped: visitedUrls.size,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error(`❌ Error scraping ${source.key}:`, error.message);
    throw error;
  } finally {
    await context.close();
  }
}

/**
 * Recursively scrape pages with pagination and DOM interaction
 */
async function scrapePageRecursively(
  page,
  source,
  sourceKey,
  allContent,
  visitedUrls,
  maxPages = source.maxPages || 5
) {
  const currentUrl = page.url();

  // Avoid revisiting pages
  if (visitedUrls.has(currentUrl) || visitedUrls.size >= maxPages) {
    return;
  }

  visitedUrls.add(currentUrl);
  console.log(`📄 Scraping page ${visitedUrls.size}/${maxPages}: ${currentUrl}`);

  try {
    // Wait for page load
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForTimeout(getRandomDelay(1000, 2500));
    await simulateHumanBrowsing(page);

    // Click expand buttons to reveal hidden content
    const expandButtons = source.navigationSelectors.expandButtons || [];
    for (const selector of expandButtons) {
      try {
        const buttons = await page.locator(selector).all();
        for (const button of buttons) {
          if (await button.isVisible()) {
            await button.scrollIntoViewIfNeeded();
            await page.waitForTimeout(getRandomDelay(500, 1200));
            await button.click();
            await page.waitForTimeout(getRandomDelay(500, 1000));
          }
        }
      } catch (e) {
        // Expand button selector not found, continue
      }
    }

    const rawHtml = await page.content();
    const cleanedText = extractCleanTextFromHTML(rawHtml);
    if (cleanedText && cleanedText.length > 100) {
      allContent.push(cleanedText);
    }

    // Look for pagination and load more elements
    let foundNextPage = false;
    const paginationSelectors = source.navigationSelectors.pagination || [];

    for (const selector of paginationSelectors) {
      try {
        const nextLink = await page.locator(selector).first();
        if (await nextLink.isVisible()) {
          const href = await nextLink.getAttribute('href');
          if (href && !visitedUrls.has(href)) {
            console.log(`  → Found next page link: ${href}`);
            await nextLink.scrollIntoViewIfNeeded();
            await page.waitForTimeout(getRandomDelay(900, 1800));
            await nextLink.click();
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
            await page.waitForTimeout(source.delayBetweenPages || getRandomDelay(1500, 3000));
            foundNextPage = true;
            break;
          }
        }
      } catch (e) {
        // Pagination selector not found, continue
      }
    }

    if (!foundNextPage) {
      foundNextPage = await detectAndClickLoadMore(page, source);
      if (foundNextPage) {
        await page.waitForTimeout(source.delayBetweenPages || getRandomDelay(1500, 3000));
      }
    }

    if (foundNextPage && visitedUrls.size < maxPages) {
      await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, maxPages);
    }

  } catch (error) {
    console.error(`  ⚠️  Error on page ${visitedUrls.size}:`, error.message);
    // Continue with next page if available
  }
}

/**
 * Scrape multiple HNWI sources in parallel with proxy rotation
 */
async function scrapeMultipleSources(sourceKeys) {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-resources',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const results = [];
    const sourceMap = await getSourceConfigMap();

    for (const sourceKey of sourceKeys) {
      if (!sourceMap[sourceKey]) {
        console.warn(`⚠️  Unknown source key: ${sourceKey}`);
        results.push({
          source: sourceKey,
          status: 'error',
          error: 'Unknown source key',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      try {
        console.log(`\n🎯 Scraping ${sourceKey}...`);
        const content = await scrapeSourceWithBrowser(browser, sourceMap[sourceKey]);
        results.push({
          source: sourceKey,
          content: content,
          status: 'success',
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ ${sourceKey}: ${content.pagesScraped} pages, ${content.contentLength} bytes`);
      } catch (error) {
        console.error(`❌ Failed to scrape ${sourceKey}:`, error.message);
        results.push({
          source: sourceKey,
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // Delay between sources to avoid hammering servers
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n✅ Completed scraping ${results.length} sources`);
    return results;
  } finally {
    await browser.close();
  }
}

/**
 * Fallback single-source scraper (for on-demand requests)
 */
async function scrapeSource(sourceKey) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const sourceMap = await getSourceConfigMap();
    if (!sourceMap[sourceKey]) {
      throw new Error(`Unknown source key: ${sourceKey}`);
    }
    return await scrapeSourceWithBrowser(browser, sourceMap[sourceKey]);
  } finally {
    await browser.close();
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'playwright-scraper' });
});

app.get('/sources', async (req, res) => {
  try {
    const sourceMap = await getSourceConfigMap();
    const sources = Object.values(sourceMap).map((config) => ({
      key: config.key,
      name: config.name,
      url: config.url,
      type: config.type,
      signals: config.signals,
      active: config.active,
      verificationStatus: config.verificationStatus,
      verifiedAt: config.verifiedAt
    }));
    res.json({ sources });
  } catch (error) {
    console.error('Failed to load source configs:', error);
    res.status(500).json({ error: 'Failed to load source configs' });
  }
});

/**
 * Verify a new data source using the complete pipeline
 * POST /verify-source
 * Body: { url, proxyUrl?, secret }
 */
app.post('/verify-source', async (req, res) => {
  const { url, proxyUrl, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    console.log(`\n🔍 Starting verification for: ${url}`);
    
    // Run verification pipeline
    const report = await verifySourceCompletePipeline(url, proxyUrl || PROXY_CONFIG.getProxyUrl(), null);
    
    return res.json({
      status: report.overallStatus,
      recommendation: report.recommendation,
      report: report
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Verification pipeline failed',
      details: error.message 
    });
  }
});

/**
 * Get verification results for a specific source
 * GET /verify-source/:sourceKey
 */
app.get('/verify-source/:sourceKey', async (req, res) => {
  const { sourceKey } = req.params;

  try {
    const source = await prisma.sourceConfig.findUnique({
      where: { key: sourceKey }
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      key: source.key,
      url: source.url,
      verificationStatus: source.verificationStatus,
      verifiedAt: source.verifiedAt,
      technicalAccessPassed: source.technicalAccessPassed,
      domDataPassed: source.domDataPassed,
      interactionsPassed: source.interactionsPassed,
      aiExtractionPassed: source.aiExtractionPassed,
      report: source.verificationReport,
      notes: source.verificationNotes
    });
  } catch (error) {
    console.error('Failed to fetch verification status:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

/**
 * Create a new source from verified data
 * POST /create-source
 * Body: { key, url, name, type, signals, navigationSelectors, contentSelectors, secret }
 */
app.post('/create-source', async (req, res) => {
  const { key, url, name, type, signals, navigationSelectors, contentSelectors, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!key || !url || !name || !type) {
    return res.status(400).json({ error: 'Missing required fields: key, url, name, type' });
  }

  try {
    // Check if source already exists
    const existing = await prisma.sourceConfig.findUnique({ where: { key } });
    if (existing) {
      return res.status(400).json({ error: 'Source key already exists' });
    }

    // Create the source
    const source = await prisma.sourceConfig.create({
      data: {
        key,
        url,
        name,
        type,
        signals: signals || [],
        navigationSelectors: navigationSelectors || {},
        contentSelectors: contentSelectors || {},
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        active: true
      }
    });

    console.log(`✅ Source created: ${key} (${url})`);
    
    res.json({
      status: 'created',
      source: {
        key: source.key,
        url: source.url,
        name: source.name,
        type: source.type
      }
    });
  } catch (error) {
    console.error('Failed to create source:', error);
    res.status(500).json({ error: 'Failed to create source', details: error.message });
  }
});

/**
 * Batch verify multiple sources
 * POST /verify-sources-batch
 * Body: { urls: [], proxyUrl?, secret }
 */
app.post('/verify-sources-batch', async (req, res) => {
  const { urls, proxyUrl, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array required' });
  }

  try {
    console.log(`\n🔍 Starting batch verification for ${urls.length} sources...`);
    
    const results = [];
    const proxyConfig = proxyUrl || PROXY_CONFIG.getProxyUrl();

    for (const url of urls) {
      try {
        const report = await verifySourceCompletePipeline(url, proxyConfig, null);
        results.push({
          url: url,
          status: report.overallStatus,
          recommendation: report.recommendation,
          blockers: report.summary.blockers,
          warnings: report.summary.warnings
        });

        // Delay between verifications to avoid overwhelming targets
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        results.push({
          url: url,
          status: 'ERROR',
          error: error.message
        });
      }
    }

    console.log(`\n✅ Batch verification complete`);
    
    res.json({
      total: urls.length,
      approved: results.filter(r => r.status === 'APPROVED').length,
      rejected: results.filter(r => r.status === 'REJECTED').length,
      manualReview: results.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED').length,
      results: results
    });
  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({ error: 'Batch verification failed', details: error.message });
  }
});

/**
 * Mark a source as verified (manual approval)
 * POST /approve-source
 * Body: { sourceKey, verificationNotes, secret }
 */
app.post('/approve-source', async (req, res) => {
  const { sourceKey, verificationNotes, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'sourceKey required' });
  }

  try {
    const source = await prisma.sourceConfig.update({
      where: { key: sourceKey },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || 'Manually approved'
      }
    });

    console.log(`✅ Source approved: ${sourceKey}`);
    
    res.json({
      status: 'approved',
      source: {
        key: source.key,
        verificationStatus: source.verificationStatus,
        verifiedAt: source.verifiedAt
      }
    });
  } catch (error) {
    console.error('Failed to approve source:', error);
    res.status(500).json({ error: 'Failed to approve source', details: error.message });
  }
});

/**
 * Reject a source
 * POST /reject-source
 * Body: { sourceKey, reason, secret }
 */
app.post('/reject-source', async (req, res) => {
  const { sourceKey, reason, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'sourceKey required' });
  }

  try {
    const source = await prisma.sourceConfig.update({
      where: { key: sourceKey },
      data: {
        verificationStatus: 'rejected',
        verificationNotes: reason || 'Manually rejected',
        active: false
      }
    });

    console.log(`❌ Source rejected: ${sourceKey}`);
    
    res.json({
      status: 'rejected',
      source: {
        key: source.key,
        verificationStatus: source.verificationStatus,
        active: source.active
      }
    });
  } catch (error) {
    console.error('Failed to reject source:', error);
    res.status(500).json({ error: 'Failed to reject source', details: error.message });
  }
});

async function startServer() {
  try {
    const sourceMap = await getSourceConfigMap();
    const availableSources = Object.keys(sourceMap);
    app.listen(PORT, () => {
      console.log(`🎯 Playwright Scraper Service listening on port ${PORT}`);
      console.log(`📍 Available sources: ${availableSources.join(', ')}`);
    });
  } catch (error) {
    console.error('Failed to initialize source configs:', error);
    process.exit(1);
  }
}

startServer();
