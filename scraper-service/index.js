import express from 'express';
import axios from 'axios';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SCRAPER_SOURCES } from './default-sources.js';
import { verifySourceCompletePipeline, technicalAccessTest, applyStealthOverrides, resolveCloudflareChallenge } from './verification-pipeline.js';
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
let SECRET = process.env.SCRAPER_SECRET;
if (!SECRET || SECRET.trim() === '') {
  if (process.env.NODE_ENV === 'production') {
    throw new Error("FATAL: SCRAPER_SECRET environment variable is missing in production!");
  }
  console.warn("WARNING: SCRAPER_SECRET is missing. Using development fallback secret.");
  SECRET = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
}
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GOOGLE_AI_MODEL = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

// ─────────────────────────────────────────────────────────────────────────────
// Concurrency Queue — queues incoming jobs to run sequentially and prevent OOM
// ─────────────────────────────────────────────────────────────────────────────
let activeScrapeJobs = 0;
const MAX_CONCURRENT_SCRAPES = 1;
const scrapeQueue = [];
let queueProcessing = false;

function enqueueJob(job) {
  scrapeQueue.push(job);
  console.log(`[Queue] Job ${job.runId} added to queue. Queue size: ${scrapeQueue.length}`);
  processQueue().catch(err => console.error('[Queue] processQueue uncaught error:', err));
}

async function processQueue() {
  if (queueProcessing) {
    return;
  }

  if (scrapeQueue.length === 0) {
    queueProcessing = false;
    return;
  }

  queueProcessing = true;

  const currentJob = scrapeQueue[0];
  console.log(`[Queue] Processing job ${currentJob.runId} from queue. Remaining in queue: ${scrapeQueue.length - 1}`);

  // Send Started webhook signal to Next.js
  if (currentJob.webhookUrl && currentJob.runId) {
    console.log(`[Queue] Sending started signal for job ${currentJob.runId} to webhook: ${currentJob.webhookUrl}`);
    try {
      await axios.post(currentJob.webhookUrl, {
        secret: SECRET,
        runId: currentJob.runId,
        isStartedSignal: true
      }, { timeout: 15000 });
      console.log(`[Queue] Started signal sent for job ${currentJob.runId}`);
    } catch (err) {
      console.error(`[Queue] Failed to send started signal webhook for job ${currentJob.runId}:`, err.message);
    }
  }

  activeScrapeJobs++;

  // ── Zombie Watchdog ───────────────────────────────────────────────────────
  // Force-kill any hung browser after configured or default minutes to prevent zombie processes.
  let zombieWatchdog = null;
  const ZOMBIE_KILL_MS = process.env.SCRAPER_ZOMBIE_KILL_MS
    ? parseInt(process.env.SCRAPER_ZOMBIE_KILL_MS, 10)
    : 8 * 60 * 1000; // 8 minutes default

  let watchdogTriggered = false;

  zombieWatchdog = setTimeout(async () => {
    watchdogTriggered = true;
    console.error(`[Watchdog] Job ${currentJob.runId} exceeded ${ZOMBIE_KILL_MS / 60000}min hard limit. Force-killing.`);
    console.error(`[Watchdog] Diagnostics at timeout:`, {
      currentSource: currentJob.jobDiagnostics.currentSource,
      currentPageUrl: currentJob.jobDiagnostics.currentPageUrl,
      pagesScraped: currentJob.jobDiagnostics.pagesScraped,
      hasBrowser: !!currentJob.jobDiagnostics.browserInstance
    });

    if (currentJob.jobDiagnostics.browserInstance) {
      console.warn(`[Watchdog] Closing active browser instance to reclaim memory...`);
      Promise.race([
        currentJob.jobDiagnostics.browserInstance.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
      ])
        .then(() => console.log(`[Watchdog] Active browser instance closed successfully.`))
        .catch((err) => console.error(`[Watchdog] Failed to close active browser instance:`, err.message));
    } else {
      console.warn(`[Watchdog] No active browser instance found to close.`);
    }

    activeScrapeJobs = Math.max(0, activeScrapeJobs - 1);
    if (currentJob.webhookUrl && currentJob.runId) {
      try {
        await axios.post(currentJob.webhookUrl, {
          secret: SECRET,
          runId: currentJob.runId,
          isFailedSignal: true,
          error: `Job timeout: exceeded ${ZOMBIE_KILL_MS / 60000}-minute hard limit. Zombie process killed.`,
          diagnostics: {
            currentSource: currentJob.jobDiagnostics.currentSource,
            currentPageUrl: currentJob.jobDiagnostics.currentPageUrl,
            pagesScraped: currentJob.jobDiagnostics.pagesScraped
          }
        });
      } catch (e) {
        console.error('[Watchdog] Failed to post failure signal:', e.message);
      }
    }

    // Remove job and trigger next
    scrapeQueue.shift();
    queueProcessing = false;
    processQueue().catch(err => console.error('[Queue] processQueue post-timeout uncaught error:', err));
  }, ZOMBIE_KILL_MS);

  try {
    await scrapeMultipleSources(
      currentJob.sources,
      currentJob.proxyUrl,
      currentJob.webhookUrl,
      currentJob.runId,
      currentJob.jobDiagnostics,
      currentJob.criteria
    );
  } catch (error) {
    console.error(`[Queue] Error running job ${currentJob.runId}:`, error);
  } finally {
    if (!watchdogTriggered) {
      clearTimeout(zombieWatchdog);
      activeScrapeJobs = Math.max(0, activeScrapeJobs - 1);
      scrapeQueue.shift();
      queueProcessing = false;
      console.log(`[Queue] Job ${currentJob.runId} finished. Queue size: ${scrapeQueue.length}`);
      processQueue().catch(err => console.error('[Queue] processQueue post-finish uncaught error:', err));
    }
  }
}

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

export async function resolveRobustLocator(page, configuredSelectors, type, brokenSelectorsAccumulator = []) {
  // 1. Try configured selectors first
  const selectorsToTry = Array.isArray(configuredSelectors) ? configuredSelectors.filter(Boolean) : [];

  for (const sel of selectorsToTry) {
    if (!isValidPlaywrightSelector(sel)) {
      brokenSelectorsAccumulator.push(`Invalid selector config: "${sel}"`);
      continue;
    }
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          return { locator: el, selectorUsed: sel, isFallback: false };
        }
      }
      if (count > 0) {
        console.log(`[SelectorCheck] Configured selector "${sel}" matched ${count} elements, but none were visible.`);
      }
    } catch (e) {
      brokenSelectorsAccumulator.push(`Error executing selector "${sel}": ${e.message}`);
    }
  }

  // 2. If configured selectors failed, use smart semantic/bilingual fallbacks
  console.log(`[SelectorCheck] All configured selectors for "${type}" failed/hidden. Trying robust semantic fallbacks.`);

  const fallbacks = {
    pagination: [
      'a[rel="next" i]',
      'button[aria-label*="next" i]',
      'a[aria-label*="next" i]',
      'a:has-text("Next")',
      'button:has-text("Next")',
      'a:has-text("التالي")',
      'button:has-text("التالي")',
      'a:has-text("الصفحة التالية")',
      'button:has-text("الصفحة التالية")',
      '[class*="pagination-next" i]',
      '[class*="next-page" i]',
      'a[href*="page=" i]',
      'a[href*="p=" i]'
    ],
    expandButtons: [
      'button[aria-expanded="false"]',
      'button[aria-expanded]',
      '[class*="expand" i]',
      '[class*="toggle" i]',
      '[class*="show-more" i]',
      'button:has-text("Expand")',
      'button:has-text("Show")',
      'button:has-text("More")',
      'button:has-text("توسيع")',
      'button:has-text("عرض")',
      'button:has-text("المزيد")',
      '[role="button"]:has-text("More")',
      '[role="button"]:has-text("المزيد")'
    ],
    memberLinks: [
      'a[href*="member" i]',
      'a[href*="profile" i]',
      'a[href*="rider" i]',
      'a[href*="player" i]',
      'a[href*="patron" i]',
      'a[href*="entity" i]',
      'a[href*="decree" i]',
      'a[href*="leader" i]',
      'a[href*="report" i]',
      'a[href*="view-entity" i]',
      'a[href*="company" i]',
      '[class*="member" i] a',
      '[class*="profile" i] a',
      '.company-link',
      '.directory-link',
      '.entity-link'
    ]
  };

  const fallbackList = fallbacks[type] || [];
  for (const sel of fallbackList) {
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          try {
            const tagName = await el.evaluate(node => node.tagName.toLowerCase());
            if (type === 'expandButtons' && (tagName === 'nav' || tagName === 'header' || tagName === 'footer')) {
              continue;
            }
          } catch (evaluateErr) {
            // ignore evaluate errors
          }
          console.log(`[SelectorCheck] Robust fallback succeeded! Used selector: "${sel}"`);
          if (selectorsToTry.length > 0) {
            brokenSelectorsAccumulator.push(`Configured selectors [${selectorsToTry.join(', ')}] were not visible/found. Resolved via fallback selector: "${sel}"`);
          }
          return { locator: el, selectorUsed: sel, isFallback: true };
        }
      }
    } catch (e) {
      // Skip invalid or failing fallbacks
    }
  }

  if (selectorsToTry.length > 0) {
    brokenSelectorsAccumulator.push(`Configured selectors [${selectorsToTry.join(', ')}] not found/visible, and all robust fallbacks failed.`);
  }
  return null;
}

export async function checkContentSelectors(page, source, brokenSelectorsAccumulator = []) {
  const contentSelectors = source.contentSelectors || {};

  const fieldsToCheck = [
    { key: 'namePatterns', label: 'Name' },
    { key: 'companyPatterns', label: 'Company' },
    { key: 'rolePatterns', label: 'Role' }
  ];

  for (const field of fieldsToCheck) {
    const patterns = contentSelectors[field.key] || [];
    if (patterns.length === 0) continue;

    let matchFound = false;
    for (const pattern of patterns) {
      let selector = pattern;
      if (pattern.startsWith('class*=')) {
        selector = `[class*="${pattern.split('=')[1]}"]`;
      } else if (pattern.startsWith('data-')) {
        selector = `[${pattern}]`;
      } else if (pattern.startsWith('href*=')) {
        selector = `[href*="${pattern.split('=')[1]}"]`;
      }

      if (!isValidPlaywrightSelector(selector)) {
        continue;
      }

      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          matchFound = true;
          break;
        }
      } catch (e) {
        // Skip check errors
      }
    }

    if (!matchFound && patterns.length > 0) {
      brokenSelectorsAccumulator.push(`Content selectors for ${field.label} [${patterns.join(', ')}] matched 0 elements on the page.`);
    }
  }
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
 * Generate mock project data for testing real estate project sources
 */
function generateMockProjectData(sourceKey, sourceName) {
  return [
    {
      projectName: 'Yas Gold Residences',
      location: 'Yas Island',
      developer: 'Aldar Properties',
      startingPrice: 1500000,
      handoverDate: 'Q4 2028',
      propertyType: 'Apartment',
      sourceUrl: 'https://example.com/yas-gold'
    },
    {
      projectName: 'Saadiyat Grove Villas',
      location: 'Saadiyat Island',
      developer: 'Aldar Properties',
      startingPrice: 6200000,
      handoverDate: 'Q2 2029',
      propertyType: 'Villa',
      sourceUrl: 'https://example.com/saadiyat-grove'
    },
    {
      projectName: 'Reem Heights Tower 2',
      location: 'Al Reem Island',
      developer: 'Mubadala',
      startingPrice: 1200000,
      handoverDate: 'Q1 2027',
      propertyType: 'Apartment',
      sourceUrl: 'https://example.com/reem-heights'
    }
  ];
}

/**
 * Generate mock source result for testing
 */
function generateMockSourceResult(source, sourceKey) {
  const isProjectSource = source.type === 'REAL_ESTATE_PROJECTS' || source.type === 'OFF_PLAN_DATA';

  if (isProjectSource) {
    const mockProjects = generateMockProjectData(sourceKey, source.name);
    const mockContent = mockProjects
      .map((proj) => `Project: ${proj.projectName}\nLocation: ${proj.location}\nDeveloper: ${proj.developer}\nPrice: AED ${proj.startingPrice}\nHandover: ${proj.handoverDate}\nType: ${proj.propertyType}\n`)
      .join('\n---\n');

    return {
      url: source.url,
      name: source.name,
      type: source.type,
      signals: source.signals,
      title: `${source.name} - Mock Data`,
      description: `Mock project data from ${source.name} (USE_MOCK_DATA mode)`,
      content: mockContent,
      mockData: true,
      timestamp: new Date().toISOString()
    };
  }

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

  // Extract inputs and textareas placeholders and values
  $('input, textarea').each((i, el) => {
    const placeholder = $(el).attr('placeholder') || '';
    const val = $(el).val() || '';
    const textNode = [placeholder, val].filter(Boolean).join(' ');
    if (textNode.trim()) {
      $(el).replaceWith(`<span> ${textNode} </span>`);
    }
  });

  // Extract canvas labels/alternative text before removing the element
  $('canvas').each((i, el) => {
    const ariaLabel = $(el).attr('aria-label') || '';
    const title = $(el).attr('title') || '';
    const fallbackText = $(el).text() || '';
    const textNode = [ariaLabel, title, fallbackText].filter(Boolean).join(' ');
    if (textNode.trim()) {
      $(el).replaceWith(`<span> ${textNode} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Extract iframe titles before removing
  $('iframe').each((i, el) => {
    const title = $(el).attr('title') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Embedded Frame: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Extract svg title or labels before removing to preserve icons text
  $('svg').each((i, el) => {
    const title = $(el).find('title').text() || $(el).attr('aria-label') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Icon: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Remove elements that are strictly layout styling, interactive widgets or media
  $('style, noscript').remove();

  // Replace br tags with newlines
  $('br').replaceWith('\n');

  // Prepend and append spacing to block elements to prevent word merging
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, article, section, header, footer, nav, aside').each((i, el) => {
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
        active: source.active !== undefined ? source.active : true
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
    console.log(`Seeded/Synced default source: ${source.key}`);
  }
}

// Source configs are loaded from Prisma at runtime.
const HNWI_SOURCES = {};

// ─── Health & Connection Test Endpoints ─────────────────────────────────────
// Called by the Next.js ScraperClient.health() and ScraperClient.testConnection()

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-scraper',
    uptime: process.uptime(),
    queue: {
      active: activeScrapeJobs,
      pending: scrapeQueue.length
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/test-connection', async (req, res) => {
  const { secret, proxyUrl } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ success: false, error: 'Invalid scraper secret' });
  }

  const result = {
    success: true,
    service: 'playwright-scraper',
    uptime: process.uptime(),
    proxy: null,
    timestamp: new Date().toISOString()
  };

  // Optional: verify proxy reachability
  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();
  if (resolvedProxyUrl) {
    try {
      const proxyCheck = await axios.get('https://api.ipify.org?format=json', {
        proxy: false,
        httpsAgent: undefined,
        timeout: 8000,
        ...(resolvedProxyUrl ? {
          proxy: {
            host: resolvedProxyUrl.replace(/https?:\/\//, '').split('@').pop()?.split(':')[0] || '',
            port: parseInt(resolvedProxyUrl.split(':').pop() || '823', 10),
            auth: resolvedProxyUrl.includes('@') ? {
              username: resolvedProxyUrl.split('://')[1]?.split(':')[0] || '',
              password: resolvedProxyUrl.split(':')[2]?.split('@')[0] || ''
            } : undefined
          }
        } : {})
      });
      result.proxy = { reachable: true, ip: proxyCheck.data?.ip || 'unknown' };
    } catch (err) {
      result.proxy = { reachable: false, error: err.message };
      // Don't fail the overall test — proxy issues are non-fatal for health check
    }
  }

  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────

app.post('/scrape', async (req, res) => {
  const { sources, secret, proxyUrl, proxyApiKey, webhookUrl, runId, criteria } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'sources array required' });
  }

  console.log('Received scrape request for sources:', sources, 'proxyUrl:', proxyUrl ? 'provided' : 'default', 'webhookUrl:', webhookUrl || 'none');

  const jobDiagnostics = {
    currentSource: 'none',
    currentPageUrl: 'none',
    pagesScraped: 0,
    browserInstance: null
  };

  const job = {
    runId,
    sources,
    proxyUrl,
    webhookUrl,
    criteria,
    jobDiagnostics
  };

  enqueueJob(job);

  res.json({
    message: 'Scrape job queued',
    status: 'queued',
    sources: sources,
    runId: runId,
    queuePosition: scrapeQueue.length
  });
});

app.get('/queue', (req, res) => {
  res.json({
    activeScrapeJobs,
    maxConcurrent: MAX_CONCURRENT_SCRAPES,
    queueLength: scrapeQueue.length,
    processing: queueProcessing,
    queue: scrapeQueue.map((job, index) => ({
      position: index + 1,
      runId: job.runId,
      sources: job.sources,
      webhookUrl: job.webhookUrl,
      currentSource: job.jobDiagnostics.currentSource,
      currentPageUrl: job.jobDiagnostics.currentPageUrl,
      pagesScraped: job.jobDiagnostics.pagesScraped
    }))
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
async function performInteractiveSearch(page, sourceKey, criteria = {}) {
  const location = criteria.emirates && criteria.emirates.length > 0 ? criteria.emirates[0] : 'Abu Dhabi';
  const query = criteria.signals && criteria.signals.length > 0 ? criteria.signals[0] : 'investment';

  if (sourceKey === 'adgm') {
    console.log('[Scraper] Interacting with ADGM Search Registry...');
    try {
      const searchInputSelector = 'input[placeholder*="Search" i], input[type="text"]';
      await page.waitForSelector(searchInputSelector, { timeout: 5000 }).catch(() => { });
      if (await page.locator(searchInputSelector).first().isVisible()) {
        await page.locator(searchInputSelector).first().fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      } else {
        console.log('[Scraper] ADGM search input not visible. Proceeding directly.');
      }
    } catch (err) {
      console.warn('[Scraper] ADGM interaction failed:', err.message);
    }
  } else if (sourceKey === 'difc') {
    console.log('[Scraper] Interacting with DIFC Search Registry...');
    try {
      const searchInputSelector = 'input[placeholder*="Search" i], input[type="search" i], .search-input';
      await page.waitForSelector(searchInputSelector, { timeout: 5000 }).catch(() => { });
      if (await page.locator(searchInputSelector).first().isVisible()) {
        await page.locator(searchInputSelector).first().fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      } else {
        console.log('[Scraper] DIFC search input not visible. Proceeding directly.');
      }
    } catch (err) {
      console.warn('[Scraper] DIFC interaction failed:', err.message);
    }
  } else if (sourceKey === 'google-maps') {
    console.log('[Scraper] Loading Google Maps results feed...');
    try {
      const containerSelector = 'div[role="feed"]';
      // Wait for the results panel to appear
      await page.waitForSelector(containerSelector, { timeout: 15000 }).catch(() => { });

      const container = page.locator(containerSelector).first();
      if (await container.isVisible()) {
        console.log('[Scraper] Scrolling Google Maps results feed to load all listings...');
        // Scroll several times to lazy-load all results
        for (let i = 0; i < 8; i++) {
          await page.evaluate((sel) => {
            const feed = document.querySelector(sel);
            if (feed) {
              feed.scrollTop = feed.scrollHeight;
            }
          }, containerSelector);
          await page.waitForTimeout(1800);
        }
        // Scroll back to top to ensure all items are in DOM
        await page.evaluate((sel) => {
          const feed = document.querySelector(sel);
          if (feed) feed.scrollTop = 0;
        }, containerSelector);
        await page.waitForTimeout(1000);

        // Extract listing data directly from the panel
        const listingData = await page.evaluate(() => {
          const results = [];
          // Each listing item in Google Maps has role="article" or is an <a> with data-value
          const items = document.querySelectorAll('div[role="feed"] > div');
          items.forEach(item => {
            const nameEl = item.querySelector('.qBF1Pd, .fontHeadlineSmall, [jsan*="fontHeadlineSmall"]');
            const phoneEl = item.querySelector('[data-item-id*="phone:tel:"], [aria-label*="Phone"]');
            const websiteEl = item.querySelector('[data-item-id="authority"], [aria-label*="Website"]');
            const categoryEl = item.querySelector('.W4Efsd:not(.W4Efsd span)');
            const ratingEl = item.querySelector('.MW4etd');
            const reviewsEl = item.querySelector('.UY7F9');
            const linkEl = item.querySelector('a.hfpxzc, a[href*="/maps/place/"]');

            const name = nameEl?.textContent?.trim();
            if (name && name.length > 1) {
              results.push({
                name,
                phone: phoneEl?.getAttribute('aria-label')?.replace('Phone:', '').trim() || phoneEl?.textContent?.trim() || '',
                website: websiteEl?.getAttribute('aria-label')?.replace('Website:', '').trim() || '',
                category: categoryEl?.textContent?.trim() || '',
                rating: ratingEl?.textContent?.trim() || '',
                reviews: reviewsEl?.textContent?.trim() || '',
                profileUrl: linkEl?.href || ''
              });
            }
          });
          return results;
        });

        if (listingData.length > 0) {
          console.log(`[Scraper] Google Maps: extracted ${listingData.length} listings from results panel.`);
          // Inject into page as a script data block so extractCleanTextFromHTML can parse it
          await page.evaluate((data) => {
            const script = document.createElement('script');
            script.type = 'application/json';
            script.id = '__GM_LISTINGS__';
            script.textContent = JSON.stringify(data);
            document.body.appendChild(script);
          }, listingData);
        } else {
          console.warn('[Scraper] Google Maps: no listings extracted from feed panel. Selectors may have changed.');
        }
      } else {
        console.warn('[Scraper] Google Maps results feed not visible.');
      }
    } catch (err) {
      console.warn('[Scraper] Google Maps interaction failed:', err.message);
    }

  } else if (sourceKey === 'yellow-pages') {
    console.log('[Scraper] Interacting with Yellow Pages listings...');
    try {
      await page.waitForSelector('.listing-title, .listing-item', { timeout: 8000 }).catch(() => { });
    } catch (err) {
      console.warn('[Scraper] Yellow Pages load wait timed out');
    }
  } else if (sourceKey === 'cpsa') {
    console.log('[Scraper] Interacting with CPSA Directory search...');
    try {
      const cityInput = 'input[id*="txtCity"]';
      await page.waitForSelector(cityInput, { timeout: 10000 });
      const city = criteria.emirates && criteria.emirates.length > 0 ? criteria.emirates[0] : 'Calgary';
      await page.locator(cityInput).fill(city);
      await page.waitForTimeout(1000);
      const searchBtn = 'input[id*="btnSearch"]';
      await page.locator(searchBtn).click();
      await page.waitForTimeout(4000);
    } catch (err) {
      console.warn('[Scraper] CPSA interaction failed:', err.message);
    }
  }
}

/**
 * Dismiss Yellow Pages push notification overlay that blocks pagination.
 * The overlay has a CDK backdrop + dialog with an 'OK' button.
 */
async function dismissYellowPagesPushOverlay(page) {
  const overlaySelectors = [
    'div.cdk-overlay-container button:has-text("OK")',
    'div.cdk-overlay-container button:has-text("No thanks")',
    'div.cdk-overlay-container button:has-text("Cancel")',
    'div.cdk-overlay-container button:has-text("Dismiss")',
    'div.notification-dialog button',
    '[class*="notification"] button',
    'button[aria-label*="close" i]',
    '.cdk-overlay-backdrop ~ * button'
  ];

  // Check if overlay is actually present
  const backdropVisible = await page.locator('.cdk-overlay-backdrop').isVisible().catch(() => false);
  if (!backdropVisible) return false;

  console.log('[YP] Push notification overlay detected. Attempting dismissal...');

  for (const sel of overlaySelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        console.log(`[YP] Clicking overlay dismiss button: "${sel}"`);
        await btn.click({ timeout: 5000, force: true });
        await page.waitForTimeout(1000);
        // Verify overlay is gone
        const stillVisible = await page.locator('.cdk-overlay-backdrop').isVisible().catch(() => false);
        if (!stillVisible) {
          console.log('[YP] Push overlay dismissed successfully.');
          return true;
        }
      }
    } catch (err) {
      // continue
    }
  }

  // Last resort: press Escape
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    console.log('[YP] Pressed Escape to dismiss overlay.');
  } catch (e) { /* ignore */ }

  return false;
}

/**
 * For Google Maps SPA: scroll the results feed to load more listings,
 * then count new synthetic scroll pages.
 */
async function scrollGoogleMapsFeed(page, visitedUrls, maxPages) {
  const feedSelector = 'div[role="feed"]';
  try {
    const feed = page.locator(feedSelector).first();
    if (!(await feed.isVisible().catch(() => false))) {
      console.log('[GoogleMaps] Results feed not found — cannot scroll.');
      return false;
    }

    // Count listings before scrolling
    const listingSelector = 'a.hfpxzc, a[href*="/maps/place/"]';
    const beforeCount = await page.locator(listingSelector).count();

    // Scroll the feed 5 times to trigger lazy-loading
    for (let i = 0; i < 5; i++) {
      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) feed.scrollTop = feed.scrollHeight;
      }, feedSelector);
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1000);

    const afterCount = await page.locator(listingSelector).count();
    console.log(`[GoogleMaps] Feed scroll: ${beforeCount} → ${afterCount} listings loaded.`);

    if (afterCount > beforeCount && visitedUrls.size < maxPages) {
      const spaKey = `${page.url()}#scroll-${visitedUrls.size}`;
      visitedUrls.add(spaKey);
      return true;
    }
  } catch (err) {
    console.warn('[GoogleMaps] Feed scroll failed:', err.message);
  }
  return false;
}

async function checkForBotBlock(page) {
  try {
    const content = await page.content();
    const lowerContent = content.toLowerCase();
    
    const blockIndicators = [
      'cf-challenge',
      'cloudflare-challenge',
      'captcha-delivery',
      'g-recaptcha',
      'h-captcha',
      'verify you are human',
      'security check',
      'checking your browser',
      'attention required',
      'access denied',
      'blocked'
    ];

    for (const indicator of blockIndicators) {
      if (lowerContent.includes(indicator)) {
        throw new Error(`Anti-bot detection / CAPTCHA page detected: "${indicator}". Scrape blocked.`);
      }
    }
  } catch (err) {
    if (err.message.includes('Anti-bot detection')) {
      throw err;
    }
  }
}

async function dismissGoogleConsent(page) {
  const url = page.url();
  if (url.includes('consent.google.') || url.includes('google.com/consent') || url.includes('consent.youtube.')) {
    console.log('[Stealth] Google Consent redirect page detected. Attempting automatic dismissal...');
    const selectors = [
      'button[aria-label*="Accept all" i]',
      'button[aria-label*="Agree" i]',
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'button:has-text("I agree")',
      'button:has-text("قبول الكل")',
      'button:has-text("أوافق")',
      'form button'
    ];
    for (const sel of selectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible()) {
          console.log(`[Stealth] Clicking Google consent button: "${sel}"`);
          await btn.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { });
          await page.waitForTimeout(2000);
          return true;
        }
      } catch (err) {
        // continue
      }
    }
  }

  try {
    const modalSelectors = [
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'button:has-text("I agree")',
      'button:has-text("قبول الكل")',
      'button:has-text("أوافق")'
    ];
    for (const sel of modalSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible()) {
        console.log(`[Stealth] Clicking in-page Google consent button: "${sel}"`);
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        return true;
      }
    }
  } catch (err) {
    // ignore
  }
  return false;
}

async function scrapeSourceWithBrowser(browser, source, sourceKey, proxyUrl = null, jobDiagnostics = null, brokenSelectors = [], criteria = {}) {
  // Return mock data if enabled for testing
  if (USE_MOCK_DATA) {
    console.log(`🎭 Mock Mode: Returning simulated data for ${sourceKey || source.key}`);
    return generateMockSourceResult(source, sourceKey || source.key);
  }

  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();

  const userAgent = getRandomDesktopUserAgent();
  const contextOptions = {
    userAgent,
    viewport: { width: 1920, height: 1080 },
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Ch-Ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"'
    }
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

  // Block heavy assets (images, media, fonts) for all crawls to save bandwidth and speed up loading.
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const blockedTypes = ['image', 'font', 'media'];

    if (blockedTypes.includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  // Apply full stealth overrides to defeat bot-detection
  await applyStealthOverrides(page);

  const allContent = [];
  const visitedUrls = new Set();

  try {
    let startUrl = source.url;
    if (sourceKey === 'google-maps') {
      const location = criteria.emirates && criteria.emirates.length > 0 ? criteria.emirates[0] : 'Abu Dhabi';
      const searchTerms = criteria.signals && criteria.signals.length > 0 ? criteria.signals.join(' ') : 'real estate investor';
      const query = encodeURIComponent(`${searchTerms} in ${location}`);
      startUrl = `https://www.google.com/maps/search/${query}`;
      console.log(`[DynamicURL] Google Maps search query constructed: ${startUrl}`);
    } else if (sourceKey === 'yellow-pages') {
      const searchTerms = criteria.signals && criteria.signals.length > 0 ? criteria.signals[0] : 'real estate';
      const normalizedQuery = searchTerms.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      startUrl = `https://www.yellowpages.ae/search/${normalizedQuery}?field=bkeyword`;
      console.log(`[DynamicURL] Yellow Pages search query constructed: ${startUrl}`);
    }

    if (jobDiagnostics) {
      jobDiagnostics.currentPageUrl = startUrl;
    }
    await page.goto(startUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await resolveCloudflareChallenge(page);
    await checkForBotBlock(page);
    await dismissGoogleConsent(page);

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

    // Perform interactive searches if applicable
    await performInteractiveSearch(page, sourceKey, criteria);

    // ── Google Maps: read the structured listing data injected by performInteractiveSearch
    // and add it as formatted plaintext directly into allContent before recursive scraping.
    if (sourceKey === 'google-maps') {
      try {
        const gmListings = await page.evaluate(() => {
          const el = document.getElementById('__GM_LISTINGS__');
          if (!el) return null;
          try { return JSON.parse(el.textContent || '[]'); } catch { return null; }
        });
        if (gmListings && gmListings.length > 0) {
          const formattedText = gmListings.map((item, i) =>
            `Business ${i + 1}:\n` +
            `  Name: ${item.name || ''}\n` +
            `  Category: ${item.category || ''}\n` +
            `  Phone: ${item.phone || ''}\n` +
            `  Website: ${item.website || ''}\n` +
            `  Rating: ${item.rating || ''} (${item.reviews || ''})\n` +
            `  Profile URL: ${item.profileUrl || ''}`
          ).join('\n\n');
          allContent.unshift(`=== Google Maps Listings (${gmListings.length} results) ===\n\n${formattedText}`);
          console.log(`[Scraper] Google Maps: added ${gmListings.length} formatted listings to content.`);
        }
      } catch (gmErr) {
        console.warn('[Scraper] Google Maps: failed to read injected listing data:', gmErr.message);
      }
    }

    await simulateHumanBrowsing(page);

    await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, source.maxPages || 5, jobDiagnostics, brokenSelectors);

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
 * Compute a lightweight hash of the visible DOM text to detect SPA content changes.
 * Used to determine whether a "click" actually rendered new content.
 */
async function getDomContentHash(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText || '');
    // Simple djb2 hash — fast and sufficient for change detection
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash |= 0; // force 32-bit int
    }
    return hash;
  } catch {
    return 0;
  }
}

/**
 * Collect all member/profile deep-links from the current page.
 * Uses configured memberLinks selectors then falls back to semantic fallbacks.
 * Returns resolved absolute URLs, excluding already-visited ones.
 */
async function collectMemberLinks(page, source, visitedUrls, brokenSelectors) {
  const configuredSelectors = source.navigationSelectors?.memberLinks || [];
  const resolved = await resolveRobustLocator(page, configuredSelectors, 'memberLinks', brokenSelectors);

  if (!resolved) {
    console.log(`[DeepCrawl] No member-link selector resolved for ${source.key || source.name}`);
    return [];
  }

  const { selectorUsed } = resolved;
  const baseUrl = new URL(source.url);
  const links = [];

  try {
    const anchors = await page.locator(selectorUsed).all();
    for (const anchor of anchors) {
      try {
        const href = await anchor.getAttribute('href');
        if (!href) continue;
        // Resolve relative URLs against the source origin
        const absolute = href.startsWith('http') ? href : new URL(href, baseUrl.origin).href;

        // Filter out social networks, search engines, and generic tracking links
        try {
          const urlObj = new URL(absolute);
          const host = urlObj.hostname.toLowerCase();
          const path = urlObj.pathname.toLowerCase();

          // For Google Maps, only allow /maps/place/ profile links
          const isGoogleMapsProfile = host.includes('google.com') && path.includes('/maps/place/');
          const isGoogleNonMaps = host.includes('google.com') && !isGoogleMapsProfile;

          const isSocialOrExternal =
            host.includes('linkedin.com') ||
            host.includes('facebook.com') ||
            host.includes('twitter.com') ||
            host.includes('x.com') ||
            host.includes('instagram.com') ||
            host.includes('youtube.com') ||
            host.includes('pinterest.com') ||
            host.includes('tiktok.com') ||
            host.includes('snapchat.com') ||
            host.includes('google.com') ||
            host.includes('whatsapp.com') ||
            host.includes('t.me');

          if (!isSocialOrExternal && !visitedUrls.has(absolute)) {
            links.push(absolute);
          }
        } catch (urlErr) {
          // ignore invalid URLs
        }
      } catch {
        // skip individual anchor errors
      }
    }
  } catch (e) {
    console.warn(`[DeepCrawl] Error collecting member links with "${selectorUsed}":`, e.message);
  }

  // Deduplicate
  const unique = [...new Set(links)];
  console.log(`[DeepCrawl] Found ${unique.length} unvisited member links via "${selectorUsed}"`);
  return unique;
}

/**
 * Recursively scrape pages with pagination, SPA-safe navigation,
 * and deep member-profile link crawling.
 */
async function scrapePageRecursively(
  page,
  source,
  sourceKey,
  allContent,
  visitedUrls,
  maxPages = source.maxPages || 5,
  jobDiagnostics = null,
  brokenSelectors = []
) {
  const currentUrl = page.url();

  // ── SPA-safe deduplication ───────────────────────────────────────────────
  // For SPAs the URL may never change. Use the URL + a page-index counter
  // embedded in visitedUrls as a sentinel key so identical URLs on different
  // virtual pages are still tracked.
  const pageIndex = visitedUrls.size;  // 0-based index before this page is added
  const trackingKey = currentUrl; // keep URL as primary key for real navigation

  if (visitedUrls.has(trackingKey) || visitedUrls.size >= maxPages) {
    return;
  }

  visitedUrls.add(trackingKey);
  if (jobDiagnostics) {
    jobDiagnostics.currentPageUrl = currentUrl;
    jobDiagnostics.pagesScraped = visitedUrls.size;
  }
  console.log(`📄 Scraping page ${visitedUrls.size}/${maxPages}: ${currentUrl}`);

  try {
    // Wait for page load
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await checkForBotBlock(page);
    await page.waitForTimeout(getRandomDelay(1000, 2500));
    await simulateHumanBrowsing(page);

    // Verify content selectors for DOM change detection
    await checkContentSelectors(page, source, brokenSelectors);

    // Click expand buttons to reveal hidden content
    const expandButtons = source.navigationSelectors.expandButtons || [];
    const resolvedExpand = await resolveRobustLocator(page, expandButtons, 'expandButtons', brokenSelectors);
    if (resolvedExpand) {
      try {
        const { selectorUsed } = resolvedExpand;
        const allButtons = await page.locator(selectorUsed).all();
        console.log(`[SelectorCheck] Clicking all ${allButtons.length} expand buttons found with "${selectorUsed}"`);
        for (const button of allButtons) {
          if (await button.isVisible()) {
            try {
              const tagName = await button.evaluate(node => node.tagName.toLowerCase());
              if (tagName === 'nav' || tagName === 'header' || tagName === 'footer') {
                continue;
              }
              await button.scrollIntoViewIfNeeded();
              await page.waitForTimeout(getRandomDelay(300, 800));
              // Use a short 8s timeout on click to avoid getting hung by overlays/backdrops
              await button.click({ timeout: 8000 });
              await page.waitForTimeout(getRandomDelay(300, 800));
            } catch (clickErr) {
              console.warn(`[SelectorCheck] Skipped clicking button: ${clickErr.message}`);
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ Failed to click expand buttons:`, e.message);
      }
    }

    // ── Extract content from all frames (including iframes) ──────────────
    const frames = page.frames();
    const frameTexts = [];
    for (const frame of frames) {
      try {
        const frameHtml = await frame.content();
        const cleanedFrameText = extractCleanTextFromHTML(frameHtml);
        if (cleanedFrameText && cleanedFrameText.length > 50) {
          frameTexts.push(cleanedFrameText);
        }
      } catch (err) {
        // Ignore cross-origin frame reading errors
      }
    }
    const cleanedText = frameTexts.join('\n\n---FRAME BREAK---\n\n');
    if (cleanedText && cleanedText.length > 100) {
      allContent.push(cleanedText);
    }

    // ── Phase A: Deep Member-Link Crawling ───────────────────────────────
    // Collect member/profile links from the listing page and visit each one
    // individually to harvest the richest possible data per person.
    const isMemberCrawlEnabled = (source.navigationSelectors?.memberLinks?.length > 0) ||
      source.deepCrawlMembers === true;

    if (isMemberCrawlEnabled && visitedUrls.size < maxPages) {
      const memberLinks = await collectMemberLinks(page, source, visitedUrls, brokenSelectors);

      for (const memberUrl of memberLinks) {
        if (visitedUrls.size >= maxPages) break;

        console.log(`[DeepCrawl] → Visiting member profile: ${memberUrl}`);
        visitedUrls.add(memberUrl);
        if (jobDiagnostics) {
          jobDiagnostics.currentPageUrl = memberUrl;
          jobDiagnostics.pagesScraped = visitedUrls.size;
        }

        try {
          await page.goto(memberUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
          await resolveCloudflareChallenge(page);
          await checkForBotBlock(page);
          await page.waitForTimeout(getRandomDelay(1200, 2500));
          await simulateHumanBrowsing(page);

          const memberFrames = page.frames();
          const memberTexts = [];
          for (const frame of memberFrames) {
            try {
              const fHtml = await frame.content();
              const fText = extractCleanTextFromHTML(fHtml);
              if (fText && fText.length > 50) memberTexts.push(fText);
            } catch { /* cross-origin */ }
          }
          const memberText = memberTexts.join('\n\n---FRAME BREAK---\n\n');
          if (memberText && memberText.length > 50) {
            allContent.push(`--- MEMBER PROFILE: ${memberUrl} ---\n${memberText}`);
            console.log(`[DeepCrawl] ✅ Collected ${memberText.length} chars from ${memberUrl}`);
          }

          // Return to listing page for the next member link
          await page.goto(currentUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
          await resolveCloudflareChallenge(page);
          await checkForBotBlock(page);
          await page.waitForTimeout(getRandomDelay(800, 1500));
        } catch (memberErr) {
          console.warn(`[DeepCrawl] ⚠️ Failed to scrape member ${memberUrl}:`, memberErr.message);
          // Try to recover by going back to the listing page
          try {
            await page.goto(currentUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
            await resolveCloudflareChallenge(page);
            await checkForBotBlock(page);
          } catch { /* ignore */ }
        }
      }
    }

    // ── Phase B: Pagination / SPA Navigation ────────────────────────────
    let foundNextPage = false;
    const paginationSelectors = source.navigationSelectors.pagination || [];

    // Snapshot DOM hash BEFORE pagination (needed for load-more check too)
    const hashBefore = await getDomContentHash(page);

    // ── Yellow Pages: dismiss push-notification overlay before paginating ──
    if (sourceKey === 'yellow-pages') {
      await dismissYellowPagesPushOverlay(page);
    }

    // ── Google Maps: for SPA listing pages, scroll the feed instead of pagination ──
    if (sourceKey === 'google-maps') {
      const scrolledNew = await scrollGoogleMapsFeed(page, visitedUrls, maxPages);
      if (scrolledNew) {
        foundNextPage = true;
      }
      // Skip normal pagination for google-maps
    } else {
      // Use hashBefore (already computed above) for SPA content change detection
      const resolvedPagination = await resolveRobustLocator(page, paginationSelectors, 'pagination', brokenSelectors);
      if (resolvedPagination) {
        const { locator, selectorUsed } = resolvedPagination;
        try {
          const href = await locator.getAttribute('href');
          const isSpaLink = !href || href === '#' || href === currentUrl || href.startsWith('javascript');

          // For real navigation: check we haven't visited the href
          // For SPA (no href change): always proceed — content hash will decide
          if (isSpaLink || !visitedUrls.has(href)) {
            const isDisabled = await locator.evaluate(el => {
              return el.hasAttribute('disabled') || 
                     el.getAttribute('aria-disabled') === 'true' || 
                     el.classList.contains('disabled') ||
                     el.classList.contains('inactive') ||
                     window.getComputedStyle(el).pointerEvents === 'none';
            }).catch(() => false);

            if (isDisabled) {
              console.log(`  → Next page element is disabled/inactive. Stopping pagination.`);
              return;
            }

            console.log(`  → Found next page element via "${selectorUsed}"${href ? ` (link: ${href})` : ' (SPA click)'}`);
            // Use JS scroll instead of scrollIntoViewIfNeeded — more reliable for Angular SPA elements
            await locator.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }));
            await page.waitForTimeout(getRandomDelay(900, 1800));
            // Use force:true to bypass Angular CDK overlay intercept issues
            await locator.click({ force: true, timeout: 15000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { });
            await page.waitForTimeout(source.delayBetweenPages || getRandomDelay(1500, 3000));

            const newUrl = page.url();
            const hashAfter = await getDomContentHash(page);
            const domChanged = hashAfter !== hashBefore;

            if (!isSpaLink && !visitedUrls.has(newUrl)) {
              // Real navigation: track by new URL
              foundNextPage = true;
            } else if (isSpaLink && domChanged) {
              // SPA: URL stayed same but DOM changed — treat as new page
              const spaKey = `${newUrl}#spa-page-${visitedUrls.size}`;
              visitedUrls.add(spaKey);
              console.log(`  → SPA DOM change detected (hash ${hashBefore}→${hashAfter}). Treating as new page.`);
              foundNextPage = true;
            } else if (!isSpaLink && visitedUrls.has(newUrl)) {
              console.log(`  → Pagination led to already-visited URL ${newUrl}. Stopping.`);
            } else {
              console.log(`  → No DOM change detected after SPA click. Stopping pagination.`);
            }
          }
        } catch (e) {
          console.warn(`⚠️ Failed to navigate using pagination element:`, e.message);
        }
      }
    }

    if (!foundNextPage) {
      foundNextPage = await detectAndClickLoadMore(page, source);
      if (foundNextPage) {
        // Check DOM hash for load-more SPA behavior as well
        const hashAfterLoadMore = await getDomContentHash(page);
        if (hashAfterLoadMore === hashBefore) {
          console.log(`  → Load-more click produced no DOM change. Stopping.`);
          foundNextPage = false;
        } else {
          await page.waitForTimeout(source.delayBetweenPages || getRandomDelay(1500, 3000));
        }
      }
    }

    if (foundNextPage && visitedUrls.size < maxPages) {
      await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, maxPages, jobDiagnostics, brokenSelectors);
    }

  } catch (error) {
    console.error(`  ⚠️  Error on page ${visitedUrls.size}:`, error.message);
    if (error.message.includes('Anti-bot detection')) {
      throw error;
    }
    // Continue with next page if available
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 + FIX 4 (JS equivalent): Gemini AI enrichment inside Railway service
// No serverless timeout — runs on long-lived Node.js process.
// Includes exponential backoff retry for 429 / 503 errors.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retry wrapper with exponential backoff for transient Gemini errors.
 * @param {() => Promise<any>} fn
 * @param {number} maxAttempts
 * @param {number} baseDelayMs
 */
async function withRetryJS(fn, maxAttempts = 6, baseDelayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message || '');
      const isRateLimit =
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('503') ||
        msg.includes('Service Unavailable');
      const isLastAttempt = attempt === maxAttempts;

      if (!isRateLimit || isLastAttempt) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`[ScraperAI] Gemini rate-limited (attempt ${attempt}/${maxAttempts}). Retrying in ${Math.round(delay)}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('[ScraperAI] withRetryJS: max attempts exceeded');
}

/**
 * Check whether a Gemini JSON response was likely cut off by the token limit.
 * @param {string} text
 */
function isLikelyTruncatedJS(text) {
  if (!text || text.length < 50) return false;
  const lastChar = text.trim().slice(-1);
  return lastChar !== ']' && lastChar !== '}';
}

/**
 * Safe JSON parse with cleanup of markdown fences and trailing comma recovery.
 * @param {string} text
 * @param {any} fallback
 */
function safeParseJsonJS(text, fallback = []) {
  if (!text) return fallback;
  let clean = text.trim();
  if (clean.includes('```')) {
    const m = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (m && m[1]) clean = m[1].trim();
  }
  const fb = clean.indexOf('[');
  const lb = clean.lastIndexOf(']');
  const fo = clean.indexOf('{');
  const lo = clean.lastIndexOf('}');
  let jsonStr = clean;
  if (fb !== -1 && lb !== -1 && (fo === -1 || fb < fo)) {
    jsonStr = clean.substring(fb, lb + 1);
  } else if (fo !== -1 && lo !== -1) {
    jsonStr = clean.substring(fo, lo + 1);
  }
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      return JSON.parse(
        jsonStr
          .replace(/,\s*\]/g, ']')
          .replace(/,\s*\}/g, '}')
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      );
    } catch {
      return fallback;
    }
  }
}

async function getGoogleAiApiKey() {
  const envKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim() !== '' && !envKey.startsWith('YOUR_')) {
    return envKey;
  }
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    if (admin && admin.preferences) {
      const prefs = typeof admin.preferences === 'string'
        ? JSON.parse(admin.preferences)
        : admin.preferences;
      const val = prefs.integrations?.googleAiApiKey;
      if (val && val.trim() !== '' && !val.includes('****')) {
        return val;
      }
    }
  } catch (err) {
    console.error('Error reading googleAiApiKey from database in scraper-service:', err.message);
  }
  return '';
}

/**
 * Call Gemini API from Node.js to extract and enrich leads from scraped content.
 * Runs on Railway — no serverless timeout risk.
 * Returns an array of enriched lead objects ready for DB upsert via webhook.
 *
 * @param {{ url, name, type, signals, title, content }} scrapedContent
 * @param {object} criteria  Search criteria from ScrapeRun
 * @returns {Promise<Array>} enrichedLeads
 */
async function callGeminiForLeads(scrapedContent, criteria = {}) {
  const apiKey = await getGoogleAiApiKey();
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    console.warn('[ScraperAI] GOOGLE_AI_API_KEY not configured — skipping AI enrichment.');
    return [];
  }

  // Truncate content to configurable length (default 100,000 characters)
  const maxInputChars = process.env.SCRAPER_MAX_INPUT_CHARS ? parseInt(process.env.SCRAPER_MAX_INPUT_CHARS, 10) : 50000;
  const cleanContent = (scrapedContent.content || '').substring(0, maxInputChars);

  // DOM vital check — skip pages with no extractable lead signals
  if (cleanContent.length < 20) {
    console.warn(`[ScraperAI] Source ${scrapedContent.name} skipped — insufficient content for AI extraction.`);
    return [];
  }

  const criteriaLines = [];
  if (criteria.budgetMin !== undefined) criteriaLines.push(`Budget minimum: ${criteria.budgetMin}`);
  if (criteria.budgetMax !== undefined) criteriaLines.push(`Budget maximum: ${criteria.budgetMax}`);
  if (Array.isArray(criteria.emirates) && criteria.emirates.length > 0) criteriaLines.push(`Locations: ${criteria.emirates.join(', ')}`);
  if (Array.isArray(criteria.signals) && criteria.signals.length > 0) criteriaLines.push(`Target signals: ${criteria.signals.join(', ')}`);
  if (criteria.tierMin !== undefined) criteriaLines.push(`Minimum tier requirement: ${criteria.tierMin} (extract ONLY leads with this tier or higher importance, e.g. if 2, extract 1 and 2)`);
  if (criteria.recentlyRelocated === true) criteriaLines.push(`Must be recently relocated`);
  if (criteria.bounds) criteriaLines.push(`Geofencing bounds (focus on this area): ${JSON.stringify(criteria.bounds)}`);
  const criteriaPrompt = criteriaLines.length > 0
    ? 'Use these purely as optional, preferred investor profiling targets to classify the extracted leads. You MUST extract ALL valid leads/profiles/individuals/companies found in the text regardless of whether they match these criteria. Assign their location, budget, and tier based on what is in the text, and do NOT filter out or discard any profile if it does not match these criteria. Treat them all as valuable leads:\n' + criteriaLines.join('\n')
    : '';

  const isDirectorySource = scrapedContent.type === 'Business Directory' ||
    scrapedContent.type === 'Google Maps Business Directory' ||
    (scrapedContent.name || '').toLowerCase().includes('maps') ||
    (scrapedContent.name || '').toLowerCase().includes('yellow');

  const absoluteRule = isDirectorySource
    ? `ABSOLUTE RULE: Since this content is from a business directory or contains company listings, you are permitted and encouraged to extract the business/company itself as a lead if no specific human name is present.
For each business:
- For "name" and "nameAr", use the actual business/company name.
- Use the actual business/company name for "company" and "companyAr" as well.
- Set "role" to "Corporate Contact" and "roleAr" to "جهة اتصال الشركة".
- Capture their telephone as "phone", website/email if present, and location.
- NEVER invent or hallucinate contact numbers or locations; only extract what is explicitly written.`
    : `ABSOLUTE RULE: Extract any real people or professionals (such as doctors, executives, etc.) explicitly named in the text. If no individual human names are found but valid business profiles or contact details are present, you are permitted and encouraged to extract the business/company itself as a lead, setting the "name" (and "nameAr") and "company" (and "companyAr") fields to the business/company name. NEVER invent data.`;

  const systemPrompt = `You are an expert at extracting high-quality leads from web content.
${absoluteRule}
CONTEXTUAL EXTRACTION RULE: Actively scan the entire text, including directories, listings, tables, running articles, press releases, news reports, paragraphs, headers, and footers. Do not just look at structured tables. Extract any person, doctor, professional, specialist, executive, or representative mentioned.
For each lead provide ALL required fields:
- name, nameAr, company, companyAr, role, roleAr, location, tier (1-3), score (0-100), email, phone, budgetMin, budgetMax, relocated, source, sourceType, signals (array), persona (2-3 sentence behavioral profile).
- Tier mapping: Tier 1 = Founders/CEOs/Chairmen/Senior Doctors/Chiefs. Tier 2 = Directors/Managers/Physicians/Specialists. Tier 3 = Professionals/Representative/Others.
- Score: Assign a relative high score (70-100) based on their professional standing.
- Treat all extracted individuals or entities as potential leads. Do NOT discard any leads based on strict real estate or geographic criteria. Accept all valid data from the source content.
${criteriaPrompt}
Output ONLY a JSON array. No other text.`;

  const userPrompt = `Extract leads:\nPage Title: ${scrapedContent.title}\nSource: ${scrapedContent.name}\nType: ${scrapedContent.type}\nContent:\n${cleanContent}`;

  const requestBody = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.0, maxOutputTokens: 4096, topP: 0.95, topK: 40 }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let rawText = '';
  try {
    rawText = await withRetryJS(async () => {
      const resp = await axios.post(endpoint, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });
      const data = resp.data;
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      return parts.map(p => p.text || '').join('');
    }, 6, 2000);
  } catch (err) {
    console.error(`[ScraperAI] Gemini call failed for source ${scrapedContent.name}:`, err.message);
    return [];
  }

  if (!rawText) return [];

  let leads = safeParseJsonJS(rawText, []);

  // If truncated, retry with reduced budget
  if ((!Array.isArray(leads) || leads.length === 0) && isLikelyTruncatedJS(rawText)) {
    const retryMaxInputChars = process.env.SCRAPER_RETRY_MAX_INPUT_CHARS ? parseInt(process.env.SCRAPER_RETRY_MAX_INPUT_CHARS, 10) : 50000;
    const retryTokens = process.env.SCRAPER_RETRY_TOKENS ? parseInt(process.env.SCRAPER_RETRY_TOKENS, 10) : 2048;
    console.warn(`[ScraperAI] Truncation detected for ${scrapedContent.name} — retrying with ${retryTokens} token budget and first ${retryMaxInputChars} characters...`);
    const retryBody = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nExtract max 10 HNWI leads from this UAE business content. Return JSON array only.\n\n${cleanContent.substring(0, retryMaxInputChars)}` }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: retryTokens, topP: 0.95, topK: 40 }
    };
    try {
      const retryResp = await withRetryJS(() => axios.post(endpoint, retryBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }), 4, 2000);
      const retryText = (retryResp.data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
      leads = safeParseJsonJS(retryText, []);
      console.info(`[ScraperAI] Truncation retry: ${Array.isArray(leads) ? leads.length : 0} leads from ${scrapedContent.name}`);
    } catch (retryErr) {
      console.error('[ScraperAI] Retry failed:', retryErr.message);
    }
  }

  if (!Array.isArray(leads) || leads.length === 0) return [];

  // Normalize and enrich each lead with coords lookup
  const UAE_COORDS = {
    'Dubai Marina': { lat: 25.0807, lng: 55.1400 }, 'Palm Jumeirah': { lat: 25.1124, lng: 55.1390 },
    'Downtown Dubai': { lat: 25.1972, lng: 55.2744 }, 'Business Bay': { lat: 25.1860, lng: 55.2650 },
    'Jumeirah': { lat: 25.2048, lng: 55.2455 }, 'DIFC': { lat: 25.2108, lng: 55.2820 },
    'Dubai': { lat: 25.2048, lng: 55.2708 }, 'Abu Dhabi': { lat: 24.4539, lng: 54.3773 },
    'Yas Island': { lat: 24.4672, lng: 54.6031 }, 'Al Reem Island': { lat: 24.4975, lng: 54.4186 },
    'Saadiyat Island': { lat: 24.5404, lng: 54.4416 }, 'Sharjah City': { lat: 25.3463, lng: 55.4209 },
    'Ajman': { lat: 25.4052, lng: 55.5136 }, 'Ras Al Khaimah': { lat: 25.7953, lng: 55.9788 }
  };

  const GLOBAL_COORDS = {
    // Saudi Arabia
    'Riyadh': { lat: 24.7136, lng: 46.6753 }, 'الرياض': { lat: 24.7136, lng: 46.6753 },
    'Jeddah': { lat: 21.5433, lng: 39.1728 }, 'جدة': { lat: 21.5433, lng: 39.1728 },
    'Saudi Arabia': { lat: 23.8859, lng: 45.0792 }, 'المملكة العربية السعودية': { lat: 23.8859, lng: 45.0792 }, 'السعودية': { lat: 23.8859, lng: 45.0792 },

    // UK & Europe
    'London': { lat: 51.5074, lng: -0.1278 }, 'لندن': { lat: 51.5074, lng: -0.1278 },
    'United Kingdom': { lat: 55.3781, lng: -3.4360 }, 'المملكة المتحدة': { lat: 55.3781, lng: -3.4360 }, 'بريطانيا': { lat: 55.3781, lng: -3.4360 },
    'Paris': { lat: 48.8566, lng: 2.3522 }, 'باريس': { lat: 48.8566, lng: 2.3522 },
    'France': { lat: 46.2276, lng: 2.2137 }, 'فرنسا': { lat: 46.2276, lng: 2.2137 },
    'Berlin': { lat: 52.5200, lng: 13.4050 }, 'برلين': { lat: 52.5200, lng: 13.4050 },
    'Germany': { lat: 51.1657, lng: 10.4515 }, 'ألمانيا': { lat: 51.1657, lng: 10.4515 },
    'Geneva': { lat: 46.2044, lng: 6.1432 }, 'جنيف': { lat: 46.2044, lng: 6.1432 },
    'Zurich': { lat: 47.3769, lng: 8.5417 }, 'زوريخ': { lat: 47.3769, lng: 8.5417 },
    'Munich': { lat: 48.1351, lng: 11.5820 }, 'ميونخ': { lat: 48.1351, lng: 11.5820 },
    'Switzerland': { lat: 46.8182, lng: 8.2275 }, 'سويسرا': { lat: 46.8182, lng: 8.2275 },

    // North America
    'New York': { lat: 40.7128, lng: -74.0060 }, 'نيويورك': { lat: 40.7128, lng: -74.0060 },
    'California': { lat: 36.7783, lng: -119.4179 }, 'كاليفورنيا': { lat: 36.7783, lng: -119.4179 },
    'United States': { lat: 37.0902, lng: -95.7129 }, 'الولايات المتحدة': { lat: 37.0902, lng: -95.7129 }, 'USA': { lat: 37.0902, lng: -95.7129 },
    'Canada': { lat: 56.1304, lng: -106.3468 }, 'كندا': { lat: 56.1304, lng: -106.3468 },
    'Toronto': { lat: 43.6532, lng: -79.3832 }, 'تورونتو': { lat: 43.6532, lng: -79.3832 },
    'Montreal': { lat: 45.5017, lng: -73.5673 }, 'مونتريال': { lat: 45.5017, lng: -73.5673 },
    'Vancouver': { lat: 49.2827, lng: -123.1207 }, 'فانكوفر': { lat: 49.2827, lng: -123.1207 },
    'Ottawa': { lat: 45.4215, lng: -75.6972 }, 'أوتاوا': { lat: 45.4215, lng: -75.6972 },
    'Edmonton': { lat: 53.5461, lng: -113.4938 }, 'إدمونتون': { lat: 53.5461, lng: -113.4938 },
    'Quebec': { lat: 46.8139, lng: -71.2082 }, 'كيبك': { lat: 46.8139, lng: -71.2082 },
    'Québec': { lat: 46.8139, lng: -71.2082 },

    // Gulf / Middle East
    'Kuwait': { lat: 29.3759, lng: 47.9774 }, 'الكويت': { lat: 29.3759, lng: 47.9774 },
    'Qatar': { lat: 25.3548, lng: 51.1849 }, 'قطر': { lat: 25.3548, lng: 51.1849 },
    'Doha': { lat: 25.2854, lng: 51.5310 }, 'الدوحة': { lat: 25.2854, lng: 51.5310 },
    'Bahrain': { lat: 26.0667, lng: 50.5577 }, 'البحرين': { lat: 26.0667, lng: 50.5577 },
    'Manama': { lat: 26.2285, lng: 50.5860 }, 'المنامة': { lat: 26.2285, lng: 50.5860 },
    'Oman': { lat: 21.5126, lng: 55.9233 }, 'عمان': { lat: 21.5126, lng: 55.9233 },
    'Muscat': { lat: 23.5859, lng: 58.4059 }, 'مسقط': { lat: 23.5859, lng: 58.4059 },
    'Egypt': { lat: 26.8206, lng: 30.8025 }, 'مصر': { lat: 26.8206, lng: 30.8025 },
    'Cairo': { lat: 30.0444, lng: 31.2357 }, 'القاهرة': { lat: 30.0444, lng: 31.2357 },
    'Lebanon': { lat: 33.8547, lng: 35.8623 }, 'لبنان': { lat: 33.8547, lng: 35.8623 },
    'Beirut': { lat: 33.8938, lng: 35.5018 }, 'بيروت': { lat: 33.8938, lng: 35.5018 },
    'Jordan': { lat: 30.5852, lng: 36.2384 }, 'الأردن': { lat: 30.5852, lng: 36.2384 },
    'Amman': { lat: 31.9539, lng: 35.9106 }, 'عمان (الأردن)': { lat: 31.9539, lng: 35.9106 },

    // Asia & Russia
    'India': { lat: 20.5937, lng: 78.9629 }, 'الهند': { lat: 20.5937, lng: 78.9629 },
    'Mumbai': { lat: 19.0760, lng: 72.8777 }, 'بومباي': { lat: 19.0760, lng: 72.8777 },
    'Russia': { lat: 61.5240, lng: 105.3188 }, 'روسيا': { lat: 61.5240, lng: 105.3188 },
    'Moscow': { lat: 55.7558, lng: 37.6173 }, 'موسكو': { lat: 55.7558, lng: 37.6173 },
    'China': { lat: 35.8617, lng: 104.1954 }, 'الصين': { lat: 35.8617, lng: 104.1954 },
    'Turkey': { lat: 38.9637, lng: 35.2433 }, 'تركيا': { lat: 38.9637, lng: 35.2433 },
    'Istanbul': { lat: 41.0082, lng: 28.9784 }, 'إسطنبول': { lat: 41.0082, lng: 28.9784 },
    'Pakistan': { lat: 30.3753, lng: 69.3451 }, 'باكستان': { lat: 30.3753, lng: 69.3451 }
  };

  const resolveCoords = (loc) => {
    const l = (loc || '').toLowerCase().trim();
    if (!l) return { lat: null, lng: null };
    for (const [key, val] of Object.entries(UAE_COORDS)) {
      if (l.includes(key.toLowerCase())) return val;
    }
    for (const [key, val] of Object.entries(GLOBAL_COORDS)) {
      if (l.includes(key.toLowerCase())) return val;
    }
    return { lat: null, lng: null }; // Return null for unknown locations instead of defaulting to Abu Dhabi
  };

  const parseBudget = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const str = String(val).replace(/aed|usd|[$,]/gi, '').trim();
    const m = str.match(/^([\d.]+)\s*(m|million|k|thousand)?/i);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (isNaN(v)) return null;
    if (/^(m|million)$/i.test(m[2])) v *= 1000000;
    else if (/^(k|thousand)$/i.test(m[2])) v *= 1000;
    return v;
  };

  const enrichedLeads = leads
    .filter(l => l && (l.name || l.company || l.phone || l.email))
    .map(l => {
      const coords = resolveCoords(l.location);
      return {
        name: l.name || 'Unknown',
        nameAr: l.nameAr || l.name || 'Unknown',
        company: l.company || 'Not Specified',
        companyAr: l.companyAr || l.company || 'Not Specified',
        role: l.role || 'Professional',
        roleAr: l.roleAr || l.role || 'Professional',
        source: l.source || scrapedContent.name,
        sourceType: l.sourceType || scrapedContent.type || 'Unknown',
        tier: Math.max(1, Math.min(3, Number(l.tier) || 2)),
        score: Math.max(0, Math.min(100, Number(l.score) || 50)),
        email: l.email || null,
        phone: l.phone || null,
        location: l.location || 'Abu Dhabi',
        latitude: (l.latitude != null && !isNaN(l.latitude)) ? l.latitude : coords.lat,
        longitude: (l.longitude != null && !isNaN(l.longitude)) ? l.longitude : coords.lng,
        budgetMin: parseBudget(l.budgetMin),
        budgetMax: parseBudget(l.budgetMax),
        relocated: l.relocated ?? null,
        signals: Array.isArray(l.signals) ? [...new Set(l.signals.map(s => String(s).trim()).filter(Boolean))] : [],
        persona: l.persona || null,
        propertyPref: l.propertyPref || null
      };
    });

  console.info(`[ScraperAI] Extracted ${enrichedLeads.length} leads from ${scrapedContent.name}`);
  return enrichedLeads;
}

/**
 * Call Gemini API from Node.js to extract and enrich projects from scraped content.
 * Bypasses leads extraction prompt entirely.
 *
 * @param {{ url, name, type, signals, title, content }} scrapedContent
 * @returns {Promise<Array>} enrichedProjects
 */
async function callGeminiForProjects(scrapedContent) {
  const apiKey = await getGoogleAiApiKey();
  if (!apiKey || apiKey.startsWith('YOUR_')) {
    console.warn('[ScraperAI] GOOGLE_AI_API_KEY not configured — skipping AI project enrichment.');
    return [];
  }

  // Truncate content to configurable length (default 50,000 characters)
  const maxInputChars = process.env.SCRAPER_MAX_INPUT_CHARS ? parseInt(process.env.SCRAPER_MAX_INPUT_CHARS, 10) : 50000;
  const cleanContent = (scrapedContent.content || '').substring(0, maxInputChars);

  // DOM vital check — skip pages with no content
  if (cleanContent.length < 20) {
    console.warn(`[ScraperAI] Source ${scrapedContent.name} skipped — insufficient content for projects AI extraction.`);
    return [];
  }

  const systemPrompt = `You are an expert Real Estate Data Extractor specializing in extracting development projects and properties.
ABSOLUTE RULE: Extract ONLY real estate project and property data. DO NOT extract human names, contacts, or buyer leads.
Extract any real estate project, off-plan development, building project, or residential community mentioned in the text.

REQUIRED FIELDS FOR EACH PROJECT:
- projectName (String): Name of the project/building.
- location (String): Exactly matching UAE areas like "Yas Island", "Saadiyat Island", "Al Reem Island", "Dubai Marina", or a specific global/international city name if applicable. Default to "Abu Dhabi" if unknown.
- developer (String or null): Name of the developer/company behind the project if mentioned.
- startingPrice (Number or null): Minimum starting price in AED (convert to plain number, remove symbols and commas, e.g. 1800000).
- handoverDate (String or null): Expected delivery/completion date (e.g., "Q4 2028").
- propertyType (String or null): Type of property, e.g., "Apartment", "Villa", "Townhouse".
- sourceUrl (String): Use "${scrapedContent.url}"

Output ONLY a JSON array of objects. No other text.`;

  const userPrompt = `Extract projects:\nPage Title: ${scrapedContent.title}\nSource: ${scrapedContent.name}\nType: ${scrapedContent.type}\nContent:\n${cleanContent}`;

  const requestBody = {
    contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
    generationConfig: { temperature: 0.0, maxOutputTokens: 4096, topP: 0.95, topK: 40 }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLE_AI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let rawText = '';
  try {
    rawText = await withRetryJS(async () => {
      const resp = await axios.post(endpoint, requestBody, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000
      });
      const data = resp.data;
      const candidate = data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      return parts.map(p => p.text || '').join('');
    }, 6, 2000);
  } catch (err) {
    console.error(`[ScraperAI] Gemini projects call failed for source ${scrapedContent.name}:`, err.message);
    return [];
  }

  if (!rawText) return [];

  const projects = safeParseJsonJS(rawText, []);
  if (!Array.isArray(projects)) return [];

  return projects.map(p => {
    // Basic price normalization
    let price = null;
    if (p.startingPrice != null) {
      if (typeof p.startingPrice === 'number') {
        price = isNaN(p.startingPrice) ? null : p.startingPrice;
      } else {
        const parsed = parseFloat(String(p.startingPrice).replace(/aed|usd|[\$,]/gi, '').trim());
        price = isNaN(parsed) ? null : parsed;
      }
    }

    return {
      projectName: p.projectName || p.name || 'Unknown Project',
      location: p.location || 'Abu Dhabi',
      developer: p.developer || null,
      startingPrice: price,
      handoverDate: p.handoverDate || null,
      propertyType: p.propertyType || null,
      sourceUrl: p.sourceUrl || scrapedContent.url
    };
  });
}

/**
 * Scrape multiple HNWI sources in parallel with proxy rotation
 */
async function scrapeMultipleSources(sourceKeys, proxyUrl = null, webhookUrl = null, runId = null, jobDiagnostics = null, criteria = {}) {
  let browser;
  try {
    // Use playwright-extra with StealthPlugin for production bot-detection bypass.
    // Falls back to vanilla chromium if stealth launch fails (e.g. unsupported environment).
    const BROWSER_ARGS = [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-resources',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
    console.log('\ud83d\udd75\ufe0f  Browser launched with full stealth init-scripts active');
    if (jobDiagnostics) {
      jobDiagnostics.browserInstance = browser;
    }

    const results = [];
    const sourceMap = await getSourceConfigMap();

    for (const sourceKey of sourceKeys) {
      if (jobDiagnostics) {
        jobDiagnostics.currentSource = sourceKey;
        jobDiagnostics.currentPageUrl = 'initializing';
        jobDiagnostics.pagesScraped = 0;
      }

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

      const sourceBrokenSelectors = [];
      try {
        console.log(`\n🎯 Scraping ${sourceKey}...`);
        const content = await scrapeSourceWithBrowser(browser, sourceMap[sourceKey], sourceKey, proxyUrl, jobDiagnostics, sourceBrokenSelectors, criteria);
        results.push({
          source: sourceKey,
          content: content,
          status: 'success',
          timestamp: new Date().toISOString()
        });

        console.log(`✅ ${sourceKey}: ${content.pagesScraped} pages, ${content.contentLength} bytes`);

        // Update database SourceConfig selector health status directly
        const uniqueIssues = [...new Set(sourceBrokenSelectors)];
        if (uniqueIssues.length > 0) {
          console.warn(`[SelectorHealth] Broken selectors detected for ${sourceKey}:`, uniqueIssues);
          try {
            await prisma.sourceConfig.update({
              where: { key: sourceKey },
              data: {
                verificationStatus: 'needs_review',
                interactionsPassed: false,
                verificationNotes: `Automatic health check failed during scrape: ${uniqueIssues.join('; ')}`
              }
            });
            console.log(`[SelectorHealth] Updated DB status for ${sourceKey} to needs_review.`);
          } catch (dbErr) {
            console.error(`[SelectorHealth] Failed to update sourceConfig in DB:`, dbErr.message);
          }
        } else {
          // Healthy scrape check
          try {
            const config = await prisma.sourceConfig.findUnique({ where: { key: sourceKey } });
            if (config && config.verificationStatus === 'needs_review') {
              await prisma.sourceConfig.update({
                where: { key: sourceKey },
                data: {
                  verificationStatus: 'verified',
                  interactionsPassed: true,
                  verificationNotes: 'Automatic health check passed successfully.'
                }
              });
              console.log(`[SelectorHealth] Restored DB status for ${sourceKey} to verified.`);
            }
          } catch (dbErr) {
            // ignore
          }
        }

        // ── AI enrichment happens HERE on Railway ──
        let enrichedLeads = [];
        let enrichedProjects = [];
        const sourceObj = sourceMap[sourceKey];
        const isProjectSource = sourceObj && (sourceObj.type === 'REAL_ESTATE_PROJECTS' || sourceObj.type === 'OFF_PLAN_DATA');

        if (isProjectSource) {
          try {
            enrichedProjects = await callGeminiForProjects(content);
            console.info(`[ScraperAI] ${sourceKey}: ${enrichedProjects.length} projects enriched locally.`);
          } catch (aiErr) {
            console.error(`[ScraperAI] Project enrichment failed for ${sourceKey}:`, aiErr.message);
          }
        } else {
          try {
            enrichedLeads = await callGeminiForLeads(content, criteria || {});
            console.info(`[ScraperAI] ${sourceKey}: ${enrichedLeads.length} leads enriched locally.`);
          } catch (aiErr) {
            console.error(`[ScraperAI] Lead enrichment failed for ${sourceKey}:`, aiErr.message);
          }
        }

        // Post pre-enriched results to webhook — webhook is now a pure DB writer
        if (webhookUrl && runId) {
          const webhookPayload = {
            secret: SECRET,
            runId: runId,
            sourceKey: sourceKey,
            selectorIssues: uniqueIssues
          };
          if (isProjectSource) {
            webhookPayload.enrichedProjects = enrichedProjects;
            console.log(`[Webhook] Posting ${enrichedProjects.length} pre-enriched projects for ${sourceKey} to: ${webhookUrl}`);
          } else {
            webhookPayload.enrichedLeads = enrichedLeads;
            console.log(`[Webhook] Posting ${enrichedLeads.length} pre-enriched leads for ${sourceKey} to: ${webhookUrl}`);
          }

          try {
            await axios.post(webhookUrl, webhookPayload, { timeout: 30000 });
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
      console.log('[Scraper] Closing browser...');
      Promise.race([
        browser.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
      ])
        .then(() => console.log('[Scraper] Browser closed successfully.'))
        .catch(err => console.error('[Scraper] Error closing browser:', err.message));
    }
  }
}

/**
 * Fallback single-source scraper (for on-demand requests)
 */
async function scrapeSource(sourceKey, proxyUrl = null) {
  const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ];
  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

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

async function startActiveDbWatchdog() {
  const WATCHDOG_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - ZOMBIE_TIMEOUT_MS);
      const zombieRuns = await prisma.scrapeRun.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          startedAt: { lt: cutoff }
        },
        select: {
          id: true,
          triggeredBy: true,
          status: true,
          startedAt: true
        }
      });

      if (zombieRuns.length > 0) {
        console.log(`[ActiveWatchdog] Found ${zombieRuns.length} database zombie runs:`, zombieRuns.map(r => r.id));

        for (const run of zombieRuns) {
          // Mark as FAILED in DB
          try {
            await prisma.scrapeRun.update({
              where: { id: run.id },
              data: {
                status: 'FAILED',
                completedAt: new Date()
              }
            });
            console.log(`[ActiveWatchdog] Force-marked run ${run.id} as FAILED in DB.`);
          } catch (dbErr) {
            console.error(`[ActiveWatchdog] Failed to update run ${run.id} in DB:`, dbErr.message);
          }

          // Create an error notification for the agent/triggeredBy user
          try {
            await prisma.notification.create({
              data: {
                agentId: run.triggeredBy,
                title: 'Scraper Error: Timeout in Scrape Run',
                body: `The scrape run was force-killed because it exceeded the maximum allowed duration of 10 minutes.`,
                type: 'error',
                data: JSON.stringify({ runId: run.id })
              }
            });
            console.log(`[ActiveWatchdog] Created error notification for user ${run.triggeredBy}.`);
          } catch (notifErr) {
            console.error(`[ActiveWatchdog] Failed to create notification for run ${run.id}:`, notifErr.message);
          }

          // Cancel any active/pending jobs matching this runId in the service's memory queue
          const activeQueueIndex = scrapeQueue.findIndex(job => job.runId === run.id);
          if (activeQueueIndex !== -1) {
            console.warn(`[ActiveWatchdog] Cancelling stuck queue job for runId ${run.id}`);
            const stuckJob = scrapeQueue[activeQueueIndex];

            // If this is the currently processing job, force-kill its browser
            if (activeQueueIndex === 0 && queueProcessing) {
              if (stuckJob.jobDiagnostics && stuckJob.jobDiagnostics.browserInstance) {
                console.warn(`[ActiveWatchdog] Force-closing browser instance for current active job ${run.id}`);
                const browserToClose = stuckJob.jobDiagnostics.browserInstance;
                Promise.race([
                  browserToClose.close(),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
                ])
                  .then(() => console.log(`[ActiveWatchdog] Stuck browser instance closed.`))
                  .catch(err => console.error(`[ActiveWatchdog] Stuck browser instance close failed:`, err.message));
              }
              // Advance active jobs counter and process the next queue item
              activeScrapeJobs = Math.max(0, activeScrapeJobs - 1);
              scrapeQueue.splice(activeQueueIndex, 1);
              queueProcessing = false;
              processQueue().catch(err => console.error('[ActiveWatchdog] Queue advancement error:', err));
            } else {
              // Just remove from queue if it's pending
              scrapeQueue.splice(activeQueueIndex, 1);
            }
          }
        }
      }
    } catch (err) {
      console.error('[ActiveWatchdog] Error in active DB watchdog interval:', err.message);
    }
  }, WATCHDOG_INTERVAL_MS);
  console.log('🛡️  Active Database Watchdog initialized (runs every 2 minutes)');
}

async function startServer() {
  try {
    // Force seeding on startup to ensure all default sources are present and updated in DB
    try {
      console.log('Seeding default scraper sources on startup...');
      await seedDefaultSources();
    } catch (seedErr) {
      console.error('Seeding default sources failed:', seedErr.message);
    }

    // Initialize the background active database watchdog
    try {
      await startActiveDbWatchdog();
    } catch (watchdogErr) {
      console.error('Failed to start active DB watchdog:', watchdogErr.message);
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

// Process-level exception handling to prevent Zombie Runs on complete service crashes
const handleFatalCrash = async (err, context) => {
  console.error(`💥 FATAL CRASH: Uncaught ${context}:`, err);
  
  if (Array.isArray(scrapeQueue) && scrapeQueue.length > 0) {
    const currentJob = scrapeQueue[0];
    if (currentJob && currentJob.webhookUrl && currentJob.runId) {
      console.error(`💥 Sending failure webhook for active job ${currentJob.runId} before crashing...`);
      try {
        await axios.post(currentJob.webhookUrl, {
          secret: SECRET,
          runId: currentJob.runId,
          isFailedSignal: true,
          error: `Fatal scraper service crash (${context}): ${err?.message || String(err)}`
        }, { timeout: 5000 });
        console.error(`💥 Failure webhook sent successfully for job ${currentJob.runId}.`);
      } catch (webhookErr) {
        console.error(`💥 Failed to send failure webhook for job ${currentJob.runId}:`, webhookErr.message);
      }
    }
  }
  process.exit(1);
};

process.on('uncaughtException', (err) => handleFatalCrash(err, 'Exception'));
process.on('unhandledRejection', (reason) => handleFatalCrash(reason, 'Rejection'));
