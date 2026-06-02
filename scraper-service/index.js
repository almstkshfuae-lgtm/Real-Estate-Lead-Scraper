import express from 'express';
import axios from 'axios';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SCRAPER_SOURCES } from './default-sources.js';
import { verifySourceCompletePipeline, technicalAccessTest } from './verification-pipeline.js';
import { validateProxyConnection, formatProxyValidationReport, verifyProxyEgress, maskProxyUrl } from './proxy-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
console.log('scraper-service loading env from:', envLocalPath, envPath);
console.log('scraper-service existing DATABASE_URL before dotenv:', process.env.DATABASE_URL);

dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

// Resolve empty DATABASE_URL to MYSQL_PUBLIC_URL if present to avoid Prisma startup crash
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
  process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL || '';
}

console.log('scraper-service DATABASE_URL after dotenv:', process.env.DATABASE_URL);

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const SECRET = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';

export function isValidPlaywrightSelector(selector) {
  if (!selector || typeof selector !== 'string') return false;
  const trimmed = selector.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith('//') || trimmed.startsWith('xpath=')) {
    const openBrackets = (trimmed.match(/\[/g) || []).length;
    const closeBrackets = (trimmed.match(/\]/g) || []).length;
    return openBrackets === closeBrackets;
  }

  if (trimmed.startsWith('text=')) {
    return true;
  }

  if (trimmed.includes('>>')) {
    const parts = trimmed.split('>>');
    return parts.every(part => isValidPlaywrightSelector(part.trim()));
  }

  let cleanSelector = trimmed;
  if (cleanSelector.startsWith('css=')) {
    cleanSelector = cleanSelector.substring(4);
  }

  cleanSelector = cleanSelector
    .replace(/:has-text\s*\([^)]*\)/g, '')
    .replace(/:text\s*\([^)]*\)/g, '')
    .replace(/:visible/g, '')
    .replace(/:text-is\s*\([^)]*\)/g, '')
    .replace(/:nth-match\s*\([^)]*\)/g, '');

  if (!cleanSelector.trim()) {
    return true;
  }

  try {
    const $ = cheerio.load('<div></div>');
    $(cleanSelector);
    return true;
  } catch (e) {
    return false;
  }
}

export function validateSelectors(obj) {
  if (!obj) return { valid: true };
  const errors = [];
  const checkValue = (val, path) => {
    if (typeof val === 'string') {
      if (!isValidPlaywrightSelector(val)) {
        errors.push(`Invalid selector at ${path}: "${val}"`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, index) => {
        checkValue(item, `${path}[${index}]`);
      });
    } else if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val)) {
        checkValue(val[key], `${path}.${key}`);
      }
    }
  };
  checkValue(obj, 'selectors');
  return {
    valid: errors.length === 0,
    errors
  };
}

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';

if (USE_MOCK_DATA) {
  console.log('⚠️  Mock Data Mode ENABLED - scraper will return simulated data instead of real requests');
} else {
  console.log('✅ Real Data Mode ENABLED - scraper will fetch actual data from sources');
}

/**
 * Proxy Configuration - Supports DataImpulse
 * Rotating residential proxies to bypass Cloudflare and anti-bot detection
 */
const ACTIVE_PROXY_PROVIDER = process.env.ACTIVE_PROXY_PROVIDER || 'dataimpulse';

function buildProxyUrl(provider) {
  if (provider === 'dataimpulse') {
    if (process.env.DATAIMPULSE_PROXY_URL) {
      return process.env.DATAIMPULSE_PROXY_URL;
    }

    const username = process.env.DATAIMPULSE_PROXY_USERNAME;
    const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
    const host = process.env.DATAIMPULSE_PROXY_HOST;
    const port = process.env.DATAIMPULSE_PROXY_PORT || '823';
    const scheme = process.env.DATAIMPULSE_PROXY_SCHEME || 'http';

    if (!username || !password || !host || !port) {
      console.warn('⚠️  DataImpulse proxy credentials are not fully configured. Provide DATAIMPULSE_PROXY_URL or DATAIMPULSE_PROXY_USERNAME/DATAIMPULSE_PROXY_PASSWORD and DATAIMPULSE_PROXY_HOST/DATAIMPULSE_PROXY_PORT.');
      return null;
    }

    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    return `${scheme}://${encodedUser}:${encodedPass}@${host}:${port}`;
  }

  return null;
}

const PROXY_CONFIG = {
  enabled: process.env.USE_PROXY ? process.env.USE_PROXY === 'true' : Boolean(process.env.DATAIMPULSE_PROXY_URL || process.env.DATAIMPULSE_PROXY_USERNAME),
  provider: ACTIVE_PROXY_PROVIDER,
  getProxyUrl: () => {
    const proxyUrl = buildProxyUrl(ACTIVE_PROXY_PROVIDER);
    if (!proxyUrl) {
      console.warn(`⚠️  ${ACTIVE_PROXY_PROVIDER} proxy URL not resolved - proceeding without proxy`);
      return null;
    }
    const safeProxyUrl = proxyUrl.replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/, '$1$2:[REDACTED]@');
    console.log(`🔒 ${ACTIVE_PROXY_PROVIDER.toUpperCase()} proxy resolved: ${safeProxyUrl}`);
    return proxyUrl;
  }
};

console.log(`🌐 Proxy Provider: ${ACTIVE_PROXY_PROVIDER}`);

function getRandomDelay(minMs = 1000, maxMs = 4000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Returns a randomized desktop user-agent string to better mimic rotating residential clients.
 */
function getRandomDesktopUserAgent() {
  const chromeMajor = 100 + Math.floor(Math.random() * 30); // 100-129
  const chromeMinor = 0;
  const chromeBuild = Math.floor(1000 + Math.random() * 9000);
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.${chromeBuild}.0 Safari/537.36`;
  return ua;
}

/**
 * Generate mock lead data for testing without real web requests
 * Toggled by USE_MOCK_DATA environment variable
 */
function generateMockLeadData(sourceKey, sourceName) {
  const mockLeads = [
    {
      name: 'Ahmed Al Mansouri',
      email: 'ahmed.mansouri@example.ae',
      phone: '+971501234567',
      location: 'Dubai',
      property_interest: 'Off-plan apartment',
      budget_aed: '2,500,000 - 3,500,000',
      signals: ['High Net Worth', 'Investor'],
      source: sourceName
    },
    {
      name: 'Fatima Al Khaleej',
      email: 'fatima.khaleej@example.ae',
      phone: '+971509876543',
      location: 'Abu Dhabi',
      property_interest: 'Villa',
      budget_aed: '5,000,000 - 8,000,000',
      signals: ['UHNW', 'Private Client'],
      source: sourceName
    },
    {
      name: 'Mohammed Al Sayegh',
      email: 'mohammed.sayegh@example.ae',
      phone: '+971506543210',
      location: 'Dubai Marina',
      property_interest: 'Penthouse',
      budget_aed: '3,000,000 - 4,500,000',
      signals: ['Business Owner', 'Executive'],
      source: sourceName
    }
  ];

  return mockLeads;
}

/**
 * Generate mock source result for testing
 */
function generateMockSourceResult(source, sourceKey) {
  const mockContent = generateMockLeadData(sourceKey, source.name)
    .map((lead) => `Lead: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nBudget: ${lead.budget_aed}\nSignals: ${lead.signals.join(', ')}\n`)
    .join('\n---\n');

  return {
    url: source.url,
    name: source.name,
    type: source.type,
    signals: source.signals,
    title: `${source.name} - Mock Data`,
    description: `Mock lead data from ${source.name} (USE_MOCK_DATA mode)`,
    content: mockContent,
    mockData: true,
    leads: generateMockLeadData(sourceKey, source.name),
    timestamp: new Date().toISOString()
  };
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
  
  // Extract and append text content from application/json, application/ld+json, and __NEXT_DATA__ scripts
  const jsonScriptContents = [];
  $('script').each((i, el) => {
    const type = $(el).attr('type');
    const id = $(el).attr('id');
    const isJson = type === 'application/json' || type === 'application/ld+json' || id === '__NEXT_DATA__';
    if (isJson) {
      const scriptText = $(el).html();
      if (scriptText && scriptText.trim()) {
        jsonScriptContents.push(scriptText.trim());
      }
    } else {
      $(el).remove();
    }
  });

  // Remove elements that are strictly layout styling, interactive widgets or media
  $('style, noscript, svg, canvas, iframe').remove();

  // Replace br tags with newlines
  $('br').replaceWith('\n');

  // Prepend and append spacing to block elements to prevent word merging
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, article, section, header, footer').each((i, el) => {
    $(el).prepend(' ').append('\n');
  });

  const bodyText = $('body').text();
  const jsonText = jsonScriptContents.join('\n');
  
  // Combine body text and JSON scripts, keeping newlines for structure
  const combinedText = bodyText + '\n' + jsonText;

  return combinedText
    .replace(/[ \t\r]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
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
    if (!isValidPlaywrightSelector(selector)) {
      console.warn(`⚠️ Skipping invalid load more selector: "${selector}"`);
      continue;
    }
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
  try {
    const configs = await prisma.sourceConfig.findMany({ where: { active: true } });
    if (!configs || configs.length === 0) {
      await seedDefaultSources();
      return getSourceConfigMap();
    }

    return configs.reduce((acc, config) => {
      acc[config.key] = {
        ...config,
        signals: typeof config.signals === 'string' ? JSON.parse(config.signals) : config.signals,
        navigationSelectors: typeof config.navigationSelectors === 'string' ? JSON.parse(config.navigationSelectors) : config.navigationSelectors,
        contentSelectors: typeof config.contentSelectors === 'string' ? JSON.parse(config.contentSelectors) : config.contentSelectors
      };
      return acc;
    }, {});
  } catch (err) {
    console.error('Prisma error in getSourceConfigMap:', err instanceof Error ? err.message : err);
    console.error('Prisma stack:', err instanceof Error ? err.stack : undefined);
    console.error('scraper-service DATABASE_URL at error time:', process.env.DATABASE_URL);
    // If Prisma / DATABASE_URL is not configured (local dev), fall back to default in-memory sources
    console.warn('Prisma not available or DATABASE_URL not set - falling back to DEFAULT_SCRAPER_SOURCES');
    const map = {};
    for (const s of DEFAULT_SCRAPER_SOURCES) {
      map[s.key] = s;
    }
    return map;
  }
}

async function seedDefaultSources() {
  for (const source of DEFAULT_SCRAPER_SOURCES) {
    const existing = await prisma.sourceConfig.findUnique({
      where: { key: source.key }
    });

    if (!existing) {
      await prisma.sourceConfig.create({
        data: {
          key: source.key,
          url: source.url,
          name: source.name,
          type: source.type,
          signals: JSON.stringify(source.signals),
          navigationSelectors: JSON.stringify(source.navigationSelectors),
          contentSelectors: JSON.stringify(source.contentSelectors),
          crawlDepth: source.crawlDepth,
          maxPages: source.maxPages,
          delayBetweenPages: source.delayBetweenPages,
          active: true
        }
      });
      console.log(`Seeded default source: ${source.key}`);
    }
  }
}

// Source configs are loaded from Prisma at runtime.
const HNWI_SOURCES = {};

app.post('/scrape', async (req, res) => {
  const { sources, secret, proxyUrl, proxyApiKey, webhookUrl, runId } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'sources array required' });
  }

  console.log('Received scrape request for sources:', sources, 'proxyUrl:', proxyUrl ? 'provided' : 'default', 'webhookUrl:', webhookUrl || 'none');

  // Background processing - return immediately
  (async () => {
    try {
      await scrapeMultipleSources(sources, proxyUrl, webhookUrl, runId);
    } catch (error) {
      console.error('Scrape pipeline error:', error);
    }
  })().catch(console.error);

  res.json({ 
    message: 'Scrape job started', 
    status: 'processing',
    sources: sources,
    runId: runId
  });
});

app.post('/scrape-source', async (req, res) => {
  const { sourceKey, secret, proxyUrl, proxyApiKey } = req.body;

  if (secret !== SECRET) {
    console.warn(`Secret mismatch: received "${secret}" (${secret?.length} chars), expected "${SECRET}" (${SECRET?.length} chars)`);
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

    const content = await scrapeSource(sourceKey, proxyUrl);
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
 * If USE_MOCK_DATA is enabled, returns simulated lead data instead
 */
async function scrapeSourceWithBrowser(browser, source, sourceKey, proxyUrl = null) {
  // Return mock data if enabled for testing
  if (USE_MOCK_DATA) {
    console.log(`🎭 Mock Mode: Returning simulated data for ${sourceKey || source.key}`);
    return generateMockSourceResult(source, sourceKey || source.key);
  }

  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();

  const contextOptions = {
    userAgent: getRandomDesktopUserAgent(),
    viewport: { width: 1920, height: 1080 }
  };

  // Prefer explicit DataImpulse env vars when provider is dataimpulse
  if (ACTIVE_PROXY_PROVIDER === 'dataimpulse') {
    // DataImpulse requires separate username/password (not embedded in URL)
    const username = process.env.DATAIMPULSE_PROXY_USERNAME;
    const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
    const host = process.env.DATAIMPULSE_PROXY_HOST || 'gw.dataimpulse.com';
    const port = process.env.DATAIMPULSE_PROXY_PORT || '823';

    if (username && password && host && port) {
      contextOptions.proxy = {
        server: `http://${host}:${port}`,
        username: username,
        password: password
      };
      console.log(`🔒 Using DataImpulse proxy for ${sourceKey || source.key}: http://${host}:${port} (auth: ${username.substring(0, 10)}...)`);
    } else {
      console.warn(`⚠️  DataImpulse proxy credentials incomplete. Proceeding without proxy.`);
    }
  }
  // Generic fallback to resolved proxy URL
  else if (resolvedProxyUrl) {
    contextOptions.proxy = { server: resolvedProxyUrl };
    console.log(`🔒 Using proxy for ${sourceKey || source.key}`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const allContent = [];
  const visitedUrls = new Set();

  try {
    await page.goto(source.url, { timeout: 45000, waitUntil: 'domcontentloaded' });

    // Force lazy-loaded content: scroll to bottom then back to top
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const step = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          totalHeight += step;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(resolve, 500);
          }
        }, 150);
      });
    });
    await page.waitForTimeout(1000);

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
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(getRandomDelay(1000, 2500));
    await simulateHumanBrowsing(page);

    // Click expand buttons to reveal hidden content
    const expandButtons = source.navigationSelectors.expandButtons || [];
    for (const selector of expandButtons) {
      if (!isValidPlaywrightSelector(selector)) {
        console.warn(`⚠️ Skipping invalid expand button selector: "${selector}"`);
        continue;
      }
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
      if (!isValidPlaywrightSelector(selector)) {
        console.warn(`⚠️ Skipping invalid pagination selector: "${selector}"`);
        continue;
      }
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
async function scrapeMultipleSources(sourceKeys, proxyUrl = null, webhookUrl = null, runId = null) {
  let browser;
  try {
    browser = await chromium.launch({ 
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-resources',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

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

      // Pre-scrape verification: Stage 1 Technical Access Test
      try {
        const accessResult = await technicalAccessTest(sourceMap[sourceKey].url, proxyUrl || PROXY_CONFIG.getProxyUrl());
        if (!accessResult.passed) {
          console.warn(maskProxyUrl(`🚫 Source ${sourceKey} failed Technical Access Test: ${accessResult.issues.join(', ')}`));
          results.push({
            source: sourceKey,
            status: 'blocked',
            error: maskProxyUrl(`Technical access blocked: ${accessResult.issues.join('; ')}`),
            timestamp: new Date().toISOString()
          });
          continue;
        }
        console.log(`✅ Source ${sourceKey} passed Technical Access Test (${accessResult.loadTime}ms, ${accessResult.htmlSize} bytes)`);
      } catch (verifyError) {
        console.warn(maskProxyUrl(`⚠️  Stage 1 verification error for ${sourceKey}, proceeding with scrape: ${verifyError.message}`));
      }

      try {
        console.log(`\n🎯 Scraping ${sourceKey}...`);
        const content = await scrapeSourceWithBrowser(browser, sourceMap[sourceKey], sourceKey, proxyUrl);
        results.push({
          source: sourceKey,
          content: content,
          status: 'success',
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ ${sourceKey}: ${content.pagesScraped} pages, ${content.contentLength} bytes`);

        // Secure Webhook Integration (POST raw scraped data back to Next.js)
        if (webhookUrl && runId) {
          console.log(`[Webhook] Posting scraped results for ${sourceKey} to: ${webhookUrl}`);
          try {
            await axios.post(webhookUrl, {
              secret: SECRET,
              runId: runId,
              sourceKey: sourceKey,
              scrapedData: content
            });
          } catch (webhookErr) {
            console.error(maskProxyUrl(`[Webhook] Failed to send results for ${sourceKey}: ${webhookErr.message}`));
          }
        }
      } catch (error) {
        console.error(maskProxyUrl(`❌ Failed to scrape ${sourceKey}: ${error.message}`));
        results.push({
          source: sourceKey,
          status: 'error',
          error: maskProxyUrl(error.message),
          timestamp: new Date().toISOString()
        });
      }

      // Delay between sources to avoid hammering servers
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n✅ Completed scraping ${results.length} sources`);

    // Post finalized completion signal to webhook
    if (webhookUrl && runId) {
      console.log(`[Webhook] Finalizing ScrapeRun: ${runId} via completed signal`);
      try {
        await axios.post(webhookUrl, {
          secret: SECRET,
          runId: runId,
          isCompletedSignal: true
        });
      } catch (webhookErr) {
        console.error(`[Webhook] Final finalization webhook post failed:`, webhookErr.message);
      }
    }

    return results;
  } catch (globalError) {
    const errorMsg = maskProxyUrl(globalError.message || String(globalError));
    console.error(`❌ Global scraper error in scrapeMultipleSources for run ${runId}:`, errorMsg);
    if (webhookUrl && runId) {
      try {
        await axios.post(webhookUrl, {
          secret: SECRET,
          runId: runId,
          isFailedSignal: true,
          error: errorMsg
        });
      } catch (webhookErr) {
        console.error(`[Webhook] Failed to post failure signal:`, webhookErr.message);
      }
    }
    throw globalError;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Fallback single-source scraper (for on-demand requests)
 */
async function scrapeSource(sourceKey, proxyUrl = null) {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const sourceMap = await getSourceConfigMap();
    if (!sourceMap[sourceKey]) {
      throw new Error(`Unknown source key: ${sourceKey}`);
    }
    return await scrapeSourceWithBrowser(browser, sourceMap[sourceKey], sourceKey, proxyUrl);
  } finally {
    await browser.close();
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'playwright-scraper' });
});

app.post('/test-connection', async (req, res) => {
  const { secret, proxyUrl } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await testScraperConnection(proxyUrl);
    res.json({ status: 'ok', message: 'Connection successful' });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Validate proxy configuration and connectivity
 * POST /validate-proxy
 * Body: { secret, proxyUrl? }
 */
app.post('/validate-proxy', async (req, res) => {
  const { secret, proxyUrl } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();
    const result = await validateProxyConnection(resolvedProxyUrl, 30000);
    console.log(formatProxyValidationReport(result));

    // If connection appears to work, attempt an egress verification comparing direct vs proxied public IP
    let egress = null;
    try {
      egress = await verifyProxyEgress(resolvedProxyUrl, 30000);
    } catch (e) {
      egress = { error: e.message || String(e) };
    }

    // Mask any raw proxy URL before returning
    const maskedResolved = resolvedProxyUrl ? resolvedProxyUrl.replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/, '$1$2:[REDACTED]@') : null;
    if (egress && typeof egress === 'object') {
      // prefer masked field from egress if present
      egress.maskedProxyUrl = egress.maskedProxyUrl || maskedResolved;
      if ('proxyUrl' in egress) delete egress.proxyUrl;
    }

    res.json({
      status: result.status,
      configured: result.configured,
      details: result,
      egressVerification: egress,
      maskedProxy: maskedResolved,
      report: formatProxyValidationReport(result)
    });
  } catch (error) {
    console.error('Proxy validation error:', error);
    res.status(500).json({ 
      error: 'Proxy validation failed',
      details: error.message 
    });
  }
});

async function testScraperConnection(proxyUrl = null) {
  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const contextOptions = {
      userAgent: getRandomDesktopUserAgent(),
      viewport: { width: 1920, height: 1080 }
    };

    if (ACTIVE_PROXY_PROVIDER === 'dataimpulse') {
      const username = process.env.DATAIMPULSE_PROXY_USERNAME;
      const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
      const host = process.env.DATAIMPULSE_PROXY_HOST || 'gw.dataimpulse.com';
      const port = process.env.DATAIMPULSE_PROXY_PORT || '823';

      if (username && password && host && port) {
        contextOptions.proxy = {
          server: `http://${host}:${port}`,
          username: username,
          password: password
        };
        console.log(`🔒 Testing scraper service through DataImpulse proxy: http://${host}:${port}`);
      }
    } else if (resolvedProxyUrl) {
      contextOptions.proxy = { server: resolvedProxyUrl };
      console.log(`🔒 Testing scraper service through proxy: ${resolvedProxyUrl.replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/, '$1$2:[REDACTED]@')}`);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    await page.goto('https://example.com', { timeout: 20000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await context.close();
  } finally {
    await browser.close();
  }
}

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
      details: maskProxyUrl(error.message) 
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

  // Validate navigation and content selectors
  if (navigationSelectors) {
    const navVal = validateSelectors(navigationSelectors);
    if (!navVal.valid) {
      return res.status(400).json({ error: `Invalid navigation selectors: ${navVal.errors.join(', ')}` });
    }
  }
  if (contentSelectors) {
    const contentVal = validateSelectors(contentSelectors);
    if (!contentVal.valid) {
      return res.status(400).json({ error: `Invalid content selectors: ${contentVal.errors.join(', ')}` });
    }
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
    res.status(500).json({ error: 'Failed to create source', details: maskProxyUrl(error.message) });
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
          error: maskProxyUrl(error.message)
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
    res.status(500).json({ error: 'Batch verification failed', details: maskProxyUrl(error.message) });
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
    res.status(500).json({ error: 'Failed to approve source', details: maskProxyUrl(error.message) });
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
    res.status(500).json({ error: 'Failed to reject source', details: maskProxyUrl(error.message) });
  }
});

async function startServer() {
  try {
    // Force seeding on startup to ensure all default sources are present and updated in DB
    try {
      console.log('Seeding default scraper sources on startup...');
      await seedDefaultSources();
    } catch (seedErr) {
      console.error('Seeding default sources failed:', seedErr.message);
    }

    const sourceMap = await getSourceConfigMap();
    const availableSources = Object.keys(sourceMap);
    const server = app.listen(PORT, () => {
      console.log(`🎯 Playwright Scraper Service listening on port ${PORT}`);
      console.log(`📍 Available sources: ${availableSources.join(', ')}`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down scraper service gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await prisma.$disconnect();
          console.log('Prisma database connection closed successfully.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing Prisma database connection during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10s if graceful shutdown hangs
      setTimeout(() => {
        console.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to initialize source configs:', error);
    process.exit(1);
  }
}

startServer();
