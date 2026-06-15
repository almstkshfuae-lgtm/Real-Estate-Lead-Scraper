import axios from 'axios';
import * as cheerio from 'cheerio';
import { prisma } from './prisma.js';
import { DEFAULT_SCRAPER_SOURCES } from '../default-sources.js';
import { technicalAccessTest, applyStealthOverrides, resolveCloudflareChallenge, getRandomDesktopUserAgent, getStealthContextOptions } from '../verification-pipeline.js';
import { maskProxyUrl, parseProxyUrl } from '../proxy-validator.js';
import { launchBrowser } from '../browser-launcher.js';
import { callGeminiForLeads, callGeminiForProjects, withRetryJS } from './ai-enricher.js';
import { resolveRobustLocator, checkContentSelectors, isValidPlaywrightSelector } from './selector-validator.js';
import { PAGINATION_END_SIGNALS, CONSENT_ACCEPT_SELECTORS, CONSENT_MODAL_SELECTORS } from './ui-strings.js';
import { encryptJson, decryptJson } from '../crypto-helper.js';

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true';
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
      console.warn('⚠️  DataImpulse proxy credentials are not fully configured.');
      return null;
    }

    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    return `${scheme}://${encodedUser}:${encodedPass}@${host}:${port}`;
  }
  return null;
}

export const PROXY_CONFIG = {
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

function getRandomDelay(minMs = 1000, maxMs = 4000) {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

function generateMockLeadData(sourceKey, sourceName, criteria = {}) {
  const location = criteria.emirates && criteria.emirates.length > 0 ? criteria.emirates[0] : 'Abu Dhabi';
  const signals = criteria.signals && criteria.signals.length > 0 ? criteria.signals : ['HNW Investor'];

  const categoryLeads = {
    adec: [
      { name: 'Saeed Al Dhaheri', nameAr: 'سعيد الظاهري', company: 'Abu Dhabi Polo Club', companyAr: 'نادي أبوظبي للبولو', role: 'Chairman', roleAr: 'رئيس مجلس الإدارة', location: 'Abu Dhabi', phone: '+971501112222', email: 'saeed.dhaheri@adec.ae', budgetMin: 15000000, budgetMax: 25000000, signals: ['Equestrian Investor', 'UHNW'], persona: 'Avid equestrian patron looking to purchase premium villas near polo clubs in Yas Island.' },
      { name: 'Hamdan Al Maktoum', nameAr: 'حمدان المكتوم', company: 'Zabeel Stables', companyAr: 'إسطبلات زعبيل', role: 'Owner', roleAr: 'مالك', location: 'Dubai Marina', phone: '+971569998888', email: 'hamdan@zabeel.ae', budgetMin: 30000000, budgetMax: 60000000, signals: ['Stables Owner', 'Royal Circle'], persona: 'Premium high-net-worth individual interested in purchasing large plots and ranches.' }
    ],
    rotary: [
      { name: 'Dr. Nadia Qassim', nameAr: 'د. نادية قاسم', company: 'Rotary UAE', companyAr: 'روتاري الإمارات', role: 'President', roleAr: 'رئيسة النادي', location: 'Downtown Dubai', phone: '+971553334444', email: 'n.qassim@rotary.ae', budgetMin: 5000000, budgetMax: 8000000, signals: ['Business Leader', 'Philanthropist'], persona: 'Prominent local business leader seeking luxury apartments for rental yield in Downtown Dubai.' }
    ],
    adgm: [
      { name: 'Tareq Al Hosani', nameAr: 'طارق الحوسني', company: 'ADGM Capital Partners', companyAr: 'شركاء سوق أبوظبي العالمي', role: 'Managing Partner', roleAr: 'شريك مدير', location: 'Al Reem Island', phone: '+971502223333', email: 't.hosani@adgmcapital.ae', budgetMin: 12000000, budgetMax: 18000000, signals: ['Fund Manager', 'Asset Management'], persona: 'Wealth manager buying luxury assets for family office portfolio diversification.' }
    ],
    difc: [
      { name: 'Sarah Jenkins', nameAr: 'سارة جينكينز', company: 'DIFC Private Equity', companyAr: 'سلطة مركز دبي المالي العالمي', role: 'Investment Director', roleAr: 'مديرة الاستثمار', location: 'DIFC', phone: '+971524445555', email: 's.jenkins@difcpe.ae', budgetMin: 8000000, budgetMax: 12000000, signals: ['Private Equity', 'Executive'], persona: 'Senior finance executive looking for modern penthouses in DIFC and Jumeirah.' }
    ]
  };

  const defaultLeads = [
    {
      name: 'Ahmed Al Mansouri',
      nameAr: 'أحمد المنصوري',
      company: 'Al Mansouri Investments',
      companyAr: 'المنصوري للاستثمار',
      role: 'Founder',
      roleAr: 'مؤسس',
      location: location,
      phone: '+971501234567',
      email: 'ahmed@mansouri.ae',
      budgetMin: 3000000,
      budgetMax: 5000000,
      signals: [...new Set(['High Net Worth', ...signals])],
      source: sourceName,
      persona: 'Self-made entrepreneur looking for residential properties in prime waterfront locations.'
    },
    {
      name: 'Fatima Al Khaleej',
      nameAr: 'فاطمة الخليج',
      company: 'Gulf Wealth Group',
      companyAr: 'مجموعة ثروة الخليج',
      role: 'VP Wealth',
      roleAr: 'نائب الرئيس للثروات',
      location: location,
      phone: '+971509876543',
      email: 'fatima@gulfwealth.ae',
      budgetMin: 6000000,
      budgetMax: 10000000,
      signals: [...new Set(['UHNW', 'Private Client', ...signals])],
      source: sourceName,
      persona: 'High profile investor searching for luxury villas and off-plan penthouse developments.'
    }
  ];

  return categoryLeads[sourceKey] || defaultLeads;
}

function generateMockProjectData(sourceKey, sourceName) {
  const projectList = {
    propertymonitor: [
      { projectName: 'Yas Gold Residences', location: 'Yas Island', developer: 'Aldar Properties', startingPrice: 1500000, handoverDate: 'Q4 2028', propertyType: 'Apartment', sourceUrl: 'https://example.com/yas-gold' },
      { projectName: 'Saadiyat Grove Villas', location: 'Saadiyat Island', developer: 'Aldar Properties', startingPrice: 6200000, handoverDate: 'Q2 2029', propertyType: 'Villa', sourceUrl: 'https://example.com/saadiyat-grove' }
    ]
  };

  const defaultProjects = [
    {
      projectName: `${sourceName || 'Abu Dhabi'} Heights`,
      location: 'Al Reem Island',
      developer: 'Aldar Properties',
      startingPrice: 1800000,
      handoverDate: 'Q3 2028',
      propertyType: 'Apartment',
      sourceUrl: 'https://example.com/heights'
    }
  ];

  return projectList[sourceKey] || defaultProjects;
}

function generateMockSourceResult(source, sourceKey, criteria = {}) {
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
      projects: mockProjects,
      timestamp: new Date().toISOString()
    };
  }

  const mockContent = generateMockLeadData(sourceKey, source.name, criteria)
    .map((lead) => `Lead: ${lead.name}\nEmail: ${lead.email}\nPhone: ${lead.phone}\nBudget: ${lead.budgetMin} - ${lead.budgetMax}\nSignals: ${lead.signals.join(', ')}\n`)
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
    leads: generateMockLeadData(sourceKey, source.name, criteria),
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

  $('input, textarea').each((i, el) => {
    const placeholder = $(el).attr('placeholder') || '';
    const val = $(el).val() || '';
    const textNode = [placeholder, val].filter(Boolean).join(' ');
    if (textNode.trim()) {
      $(el).replaceWith(`<span> ${textNode} </span>`);
    }
  });

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

  $('iframe').each((i, el) => {
    const title = $(el).attr('title') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Embedded Frame: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  $('svg').each((i, el) => {
    const title = $(el).find('title').text() || $(el).attr('aria-label') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Icon: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  $('style, noscript').remove();
  $('br').replaceWith('\n');

  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, article, section, header, footer, nav, aside').each((i, el) => {
    $(el).prepend(' ').append('\n');
  });

  const bodyText = $('body').text();
  const jsonText = jsonScriptContents.join('\n');
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

  const pagination = source.navigationSelectors?.pagination || [];
  for (const selector of [...pagination, ...loadMoreSelectors]) {
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
      // ignore
    }
  }
  return false;
}

export async function getSourceConfigMap() {
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
        navigationSelectors: decryptJson(config.navigationSelectors),
        contentSelectors: decryptJson(config.contentSelectors)
      };
      return acc;
    }, {});
  } catch (err) {
    console.error('Prisma error in getSourceConfigMap:', err instanceof Error ? err.message : err);
    console.warn('Prisma not available or DATABASE_URL not set - falling back to DEFAULT_SCRAPER_SOURCES');
    const map = {};
    for (const s of DEFAULT_SCRAPER_SOURCES) {
      map[s.key] = s;
    }
    return map;
  }
}

export async function seedDefaultSources() {
  for (const source of DEFAULT_SCRAPER_SOURCES) {
    await prisma.sourceConfig.upsert({
      where: { key: source.key },
      update: {
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: encryptJson(source.navigationSelectors),
        contentSelectors: encryptJson(source.contentSelectors),
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
        navigationSelectors: encryptJson(source.navigationSelectors),
        contentSelectors: encryptJson(source.contentSelectors),
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: true
      }
    });
    console.log(`Seeded/Synced default source: ${source.key}`);
  }
}

async function performInteractiveSearch(page, sourceKey, criteria = {}, brokenSelectors = []) {
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
      }
    } catch (err) {
      console.warn('[Scraper] DIFC interaction failed:', err.message);
    }
  } else if (sourceKey === 'google-maps') {
    console.log('[Scraper] Loading Google Maps results feed...');
    try {
      const containerSelector = 'div[role="feed"]';
      await page.waitForSelector(containerSelector, { timeout: 15000 }).catch(() => { });

      const container = page.locator(containerSelector).first();
      if (await container.isVisible()) {
        console.log('[Scraper] Scrolling Google Maps results feed...');
        for (let i = 0; i < 8; i++) {
          await page.evaluate((sel) => {
            const feed = document.querySelector(sel);
            if (feed) feed.scrollTop = feed.scrollHeight;
          }, containerSelector);
          await page.waitForTimeout(1800);
        }
        await page.evaluate((sel) => {
          const feed = document.querySelector(sel);
          if (feed) feed.scrollTop = 0;
        }, containerSelector);
        await page.waitForTimeout(1000);

        const listingData = await page.evaluate(() => {
          const results = [];
          let items = Array.from(document.querySelectorAll('div[role="feed"] > div'));
          
          // Fallback: If feed items aren't found directly, look for any listing anchor tag
          if (items.length === 0) {
            const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
            items = links.map(link => {
              return link.closest('div[role="feed"] > div') || link.closest('[class*="card"]') || link.parentElement?.parentElement || link;
            }).filter((v, i, a) => a.indexOf(v) === i);
          }

          items.forEach(item => {
            const linkEl = item.querySelector('a[href*="/maps/place/"], a.hfpxzc');
            
            // 1. Robust Name Extraction
            let name = linkEl?.getAttribute('aria-label')?.trim() || '';
            if (!name) {
              const nameEl = item.querySelector('.qBF1Pd, .fontHeadlineSmall, [class*="Headline" i], [class*="headline" i], [jsan*="fontHeadlineSmall"]');
              name = nameEl?.textContent?.trim() || '';
            }
            if (!name) {
              const headingEl = item.querySelector('[role="heading"], h1, h2, h3, h4, h5, h6');
              name = headingEl?.textContent?.trim() || '';
            }
            if (!name && linkEl) {
              name = linkEl.textContent?.trim() || '';
            }

            if (name && name.length > 1) {
              // 2. Robust Phone Number Extraction
              const phoneEl = item.querySelector('[data-item-id*="phone:tel:"], [aria-label*="Phone"]');
              let phone = phoneEl?.getAttribute('aria-label')?.replace(/Phone:\s*/i, '').trim() || phoneEl?.textContent?.trim() || '';
              if (!phone) {
                const textContent = item.textContent || '';
                const match = textContent.match(/(?:\+971|00971|0)(?:\s*5[024568]|\s*[234679])[\s-]*\d{3}[\s-]*\d{4}/);
                if (match) {
                  phone = match[0].trim();
                }
              }

              // 3. Robust Website Extraction
              const websiteEl = item.querySelector('[data-item-id="authority"], [aria-label*="Website"]');
              let website = websiteEl?.getAttribute('aria-label')?.replace(/Website:\s*/i, '').trim() || websiteEl?.href || '';
              if (!website) {
                const anchors = Array.from(item.querySelectorAll('a'));
                for (const anchor of anchors) {
                  const href = anchor.href || '';
                  if (href && !href.includes('google.com') && !href.includes('google.ae') && !href.startsWith('javascript:')) {
                    website = href;
                    break;
                  }
                }
              }

              // 4. Robust Category Extraction (with rating/reviews fallback)
              const categoryEl = item.querySelector('.W4Efsd:not(.W4Efsd span)');
              const ratingEl = item.querySelector('.MW4etd');
              const reviewsEl = item.querySelector('.UY7F9');
              
              let category = categoryEl?.textContent?.trim() || '';
              let rating = ratingEl?.textContent?.trim() || '';
              let reviews = reviewsEl?.textContent?.trim() || '';

              if (!rating || !reviews || !category) {
                const textContent = item.textContent || '';
                const segments = textContent.split(/[\u00B7\u2022|+-]/).map(s => s.trim()).filter(Boolean);

                if (!rating) {
                  const ratingMatch = textContent.match(/\b([1-5]\.[0-9])\b/);
                  if (ratingMatch) rating = ratingMatch[1];
                }
                if (!reviews) {
                  const reviewsMatch = textContent.match(/\(([\d,.]+k?)\)/i) || textContent.match(/\b([\d,.]+k?)\s*(reviews|ratings|تقييم)\b/i);
                  if (reviewsMatch) reviews = reviewsMatch[1];
                }
                if (!category) {
                  const categoryKeywords = [
                    'real estate', 'property', 'developer', 'agency', 'agent', 'broker', 
                    'consultant', 'investment', 'builder', 'contractor', 'construction',
                    'عقارات', 'مطور', 'وكيل', 'وسيط', 'استثمار', 'بناء'
                  ];
                  for (const segment of segments) {
                    const lowerSeg = segment.toLowerCase();
                    if (categoryKeywords.some(keyword => lowerSeg.includes(keyword)) && segment.length < 50) {
                      category = segment;
                      break;
                    }
                  }
                  
                  if (!category && segments.length > 1) {
                    for (let i = 0; i < segments.length; i++) {
                      const seg = segments[i];
                      if (seg.includes(rating) || (reviews && seg.includes(reviews))) {
                        if (i + 1 < segments.length && segments[i + 1].length < 40) {
                          category = segments[i + 1];
                          break;
                        }
                      }
                    }
                  }
                }
              }

              results.push({
                name,
                phone,
                website,
                category,
                rating,
                reviews,
                profileUrl: linkEl?.href || ''
              });
            }
          });
          return results;
        });

        if (listingData && listingData.length > 0) {
          console.log(`[Scraper] Google Maps: extracted ${listingData.length} listings.`);
          await page.evaluate((data) => {
            const script = document.createElement('script');
            script.type = 'application/json';
            script.id = '__GM_LISTINGS__';
            script.textContent = JSON.stringify(data);
            document.body.appendChild(script);
          }, listingData);
        } else {
          console.warn('[Scraper] Google Maps feed container was visible but 0 listings could be parsed. Selectors might be broken.');
          if (brokenSelectors) {
            brokenSelectors.push('google-maps-listing-item-selectors');
          }
          throw new Error('Google Maps feed found but failed to parse any listings. Selectors might be broken.');
        }
      }
    } catch (err) {
      console.error('[Scraper] Google Maps interaction failed:', err.message);
      throw err;
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

  const backdropVisible = await page.locator('.cdk-overlay-backdrop').isVisible().catch(() => false);
  if (!backdropVisible) return false;

  console.log('[YP] Push notification overlay detected. Attempting dismissal...');
  for (const sel of overlaySelectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ timeout: 5000, force: true });
        await page.waitForTimeout(1000);
        const stillVisible = await page.locator('.cdk-overlay-backdrop').isVisible().catch(() => false);
        if (!stillVisible) return true;
      }
    } catch (err) { /* ignore */ }
  }

  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch (e) { /* ignore */ }
  return false;
}

async function scrollGoogleMapsFeed(page, visitedUrls, maxPages) {
  const feedSelector = 'div[role="feed"]';
  try {
    const feed = page.locator(feedSelector).first();
    if (!(await feed.isVisible().catch(() => false))) {
      return false;
    }

    const isEnd = await page.evaluate((signals) => {
      const text = document.body.innerText;
      return signals.some(sig => text.includes(sig));
    }, PAGINATION_END_SIGNALS);
    if (isEnd) return false;

    const listingSelector = 'a.hfpxzc, a[href*="/maps/place/"]';
    const beforeCount = await page.locator(listingSelector).count();

    for (let i = 0; i < 5; i++) {
      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) feed.scrollTop = feed.scrollHeight;
      }, feedSelector);
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(1000);

    const afterCount = await page.locator(listingSelector).count();
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
      'cf-challenge', 'cloudflare-challenge', 'captcha-delivery',
      'g-recaptcha', 'h-captcha', 'verify you are human',
      'security check', 'checking your browser', 'attention required',
      'access denied', 'blocked'
    ];

    for (const indicator of blockIndicators) {
      if (lowerContent.includes(indicator)) {
        throw new Error(`Anti-bot detection / CAPTCHA page detected: "${indicator}". Scrape blocked.`);
      }
    }
  } catch (err) {
    if (err.message.includes('Anti-bot detection')) throw err;
  }
}

async function dismissGoogleConsent(page) {
  const url = page.url();
  if (url.includes('consent.google.') || url.includes('google.com/consent') || url.includes('consent.youtube.')) {
    for (const sel of CONSENT_ACCEPT_SELECTORS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible()) {
          await btn.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => { });
          await page.waitForTimeout(2000);
          return true;
        }
      } catch (err) { /* ignore */ }
    }
  }

  try {
    for (const sel of CONSENT_MODAL_SELECTORS) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible()) {
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(2000);
        return true;
      }
    }
  } catch (err) { /* ignore */ }
  return false;
}

async function getDomContentHash(page) {
  try {
    const text = await page.evaluate(() => document.body?.innerText || '');
    let hash = 5381;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

async function collectMemberLinks(page, source, visitedUrls, brokenSelectors) {
  const configuredSelectors = source.navigationSelectors?.memberLinks || [];
  const resolved = await resolveRobustLocator(page, configuredSelectors, 'memberLinks', brokenSelectors);

  if (!resolved) return [];

  const { selectorUsed } = resolved;
  const baseUrl = new URL(source.url);
  const links = [];

  try {
    const anchors = await page.locator(selectorUsed).all();
    for (const anchor of anchors) {
      try {
        const href = await anchor.getAttribute('href');
        if (!href) continue;
        const absolute = href.startsWith('http') ? href : new URL(href, baseUrl.origin).href;

        try {
          const urlObj = new URL(absolute);
          const host = urlObj.hostname.toLowerCase();
          const path = urlObj.pathname.toLowerCase();

          const isGoogleMapsProfile = host.includes('google.com') && path.includes('/maps/place/');
          const isSocialOrExternal =
            host.includes('linkedin.com') || host.includes('facebook.com') ||
            host.includes('twitter.com') || host.includes('x.com') ||
            host.includes('instagram.com') || host.includes('youtube.com') ||
            host.includes('pinterest.com') || host.includes('tiktok.com') ||
            host.includes('snapchat.com') || (host.includes('google.com') && !isGoogleMapsProfile) ||
            host.includes('whatsapp.com') || host.includes('t.me');

          // Check if it is an internal navigation link (like home page, contact us, etc.)
          const cleanPath = path.replace(/\/$/, '');
          const isInternalNavigation = 
            cleanPath === '' || 
            cleanPath === '/index.html' ||
            cleanPath === '/index.php' ||
            ['/contact', '/contact-us', '/about', '/about-us', '/login', '/signin', '/signup', '/register', 
             '/privacy', '/privacy-policy', '/terms', '/terms-of-use', '/terms-of-service', '/faq', '/help', 
             '/jobs', '/careers', '/press', '/blog', '/news', '/cookie-policy', '/sitemap', '/sitemap.xml'
            ].some(navPath => cleanPath.includes(navPath)) ||
            ['page=', 'p=', 'pg=', '/page/'].some(param => urlObj.search.includes(param) || cleanPath.includes(param));

          // Also check if the link is inside a nav, header, or footer layout element
          const isLinkInNavOrFooter = await anchor.evaluate(el => {
            let current = el;
            while (current) {
              const tag = current.tagName?.toLowerCase();
              if (['nav', 'header', 'footer', 'aside', 'menu'].includes(tag)) {
                return true;
              }
              const id = current.id?.toLowerCase() || '';
              const className = typeof current.className === 'string' ? current.className.toLowerCase() : '';
              if (
                id.includes('nav') || id.includes('header') || id.includes('footer') || id.includes('sidebar') || id.includes('menu') ||
                className.includes('nav') || className.includes('header') || className.includes('footer') || className.includes('sidebar') || className.includes('menu')
              ) {
                return true;
              }
              current = current.parentElement;
            }
            return false;
          }).catch(() => false);

          if (!isSocialOrExternal && !isInternalNavigation && !isLinkInNavOrFooter && !visitedUrls.has(absolute)) {
            links.push(absolute);
          }
        } catch (urlErr) { /* ignore */ }
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.warn(`[DeepCrawl] Error collecting member links:`, e.message);
  }

  const unique = [...new Set(links)];
  return unique;
}async function flagSourceNeedsReview(sourceKey, issues) {
  if (!sourceKey || !issues || issues.length === 0) return;
  const uniqueIssues = [...new Set(issues)];
  console.warn(`🚨 Immediate flag: > 3 selector health issues detected for ${sourceKey}:`, uniqueIssues);
  try {
    await prisma.sourceConfig.update({
      where: { key: sourceKey },
      data: {
        verificationStatus: 'needs_review',
        interactionsPassed: false,
        verificationNotes: `Automatic immediate health check failed: ${uniqueIssues.join('; ')}`
      }
    });
    console.log(`🚨 Database marked as needs_review for ${sourceKey}`);
  } catch (dbErr) {
    console.error(`[SelectorHealth] Failed to update sourceConfig DB for ${sourceKey}:`, dbErr.message);
  }
}

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
  const isSpa = sourceKey === 'google-maps';
  const trackingKey = isSpa ? `${currentUrl}#scroll-${visitedUrls.size}` : currentUrl;

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
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await checkForBotBlock(page);
    await page.waitForTimeout(getRandomDelay(1000, 2500));
    await simulateHumanBrowsing(page);

    await checkContentSelectors(page, source, brokenSelectors);

    if (brokenSelectors.length > 3) {
      console.warn(`[SelectorHealth] > 3 broken selectors detected for ${sourceKey} on recursive scrape page. Senders will evaluate final status after run.`);
    }

    // Click expand buttons
    const expandButtons = source.navigationSelectors?.expandButtons || [];
    const resolvedExpand = await resolveRobustLocator(page, expandButtons, 'expandButtons', brokenSelectors);
    if (resolvedExpand) {
      try {
        const { selectorUsed } = resolvedExpand;
        const allButtons = await page.locator(selectorUsed).all();
        let failCount = 0;
        for (const button of allButtons) {
          if (await button.isVisible()) {
            try {
              const isNavLayout = await button.evaluate(el => {
                let current = el;
                while (current) {
                  const tag = current.tagName?.toLowerCase();
                  if (['nav', 'header', 'footer', 'aside', 'menu'].includes(tag)) {
                    return true;
                  }
                  const id = current.id?.toLowerCase() || '';
                  const className = typeof current.className === 'string' ? current.className.toLowerCase() : '';
                  if (
                    id.includes('nav') || id.includes('header') || id.includes('footer') || id.includes('sidebar') || id.includes('menu') ||
                    className.includes('nav') || className.includes('header') || className.includes('footer') || className.includes('sidebar') || className.includes('menu')
                  ) {
                    return true;
                  }
                  current = current.parentElement;
                }
                return false;
              }).catch(() => false);

              if (isNavLayout) {
                continue;
              }

              await button.scrollIntoViewIfNeeded();
              await page.waitForTimeout(getRandomDelay(300, 800));
              await button.click({ timeout: 8000 });
              await page.waitForTimeout(getRandomDelay(300, 800));
            } catch (clickErr) {
              failCount++;
            }
          }
        }
        if (failCount > 3) {
          console.warn(`⚠️ Warning: ${failCount} consecutive expand buttons failed to click under selector "${selectorUsed}" for source "${sourceKey || source?.key}"`);
        }
      } catch (e) { /* ignore */ }
    }

    // Extract all frame texts
    const frames = page.frames();
    const frameTexts = [];
    for (const frame of frames) {
      try {
        const frameHtml = await frame.content();
        const cleanedFrameText = extractCleanTextFromHTML(frameHtml);
        if (cleanedFrameText && cleanedFrameText.length > 50) {
          frameTexts.push(cleanedFrameText);
        }
      } catch (err) { /* ignore cross-origin */ }
    }
    const cleanedText = frameTexts.join('\n\n---FRAME BREAK---\n\n');
    if (cleanedText && cleanedText.length > 100) {
      allContent.push(cleanedText);
    }

    // Deep member profiling
    const isMemberCrawlEnabled = (source.navigationSelectors?.memberLinks?.length > 0) || source.deepCrawlMembers === true;
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
            } catch { /* ignore */ }
          }
          const memberText = memberTexts.join('\n\n---FRAME BREAK---\n\n');
          if (memberText && memberText.length > 50) {
            allContent.push(`--- MEMBER PROFILE: ${memberUrl} ---\n${memberText}`);
          }

          // Go back to listing page
          await page.goto(currentUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
          await resolveCloudflareChallenge(page);
          await checkForBotBlock(page);
        } catch (memberErr) {
          console.warn(`[DeepCrawl] Failed member ${memberUrl}:`, memberErr.message);
          try {
            await page.goto(currentUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
            await resolveCloudflareChallenge(page);
            await checkForBotBlock(page);
          } catch { /* ignore */ }
        }
      }
    }

    // Pagination
    let foundNextPage = false;
    const paginationSelectors = source.navigationSelectors?.pagination || [];
    const hashBefore = await getDomContentHash(page);

    if (sourceKey === 'yellow-pages') {
      await dismissYellowPagesPushOverlay(page);
    }

    if (sourceKey === 'google-maps') {
      foundNextPage = await scrollGoogleMapsFeed(page, visitedUrls, maxPages);
    } else {
      const resolvedPagination = await resolveRobustLocator(page, paginationSelectors, 'pagination', brokenSelectors);
      if (resolvedPagination) {
        const { locator, selectorUsed } = resolvedPagination;
        try {
          const href = await locator.getAttribute('href');
          const isSpaLink = !href || href === '#' || href === currentUrl || href.startsWith('javascript');

          if (isSpaLink || !visitedUrls.has(href)) {
            const isDisabled = await locator.evaluate(el => {
              return el.hasAttribute('disabled') || 
                     el.getAttribute('aria-disabled') === 'true' || 
                     el.classList.contains('disabled') ||
                     el.classList.contains('inactive') ||
                     window.getComputedStyle(el).pointerEvents === 'none';
            }).catch(() => false);

            if (isDisabled) return;

            await locator.evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' }));
            await page.waitForTimeout(getRandomDelay(900, 1800));
            await locator.click({ force: true, timeout: 15000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => { });
            const pageDelay = Math.max(
              (jobDiagnostics && jobDiagnostics.globalRateLimitDelay) || 3000,
              source.delayBetweenPages || 2000
            );
            await page.waitForTimeout(pageDelay);

            const newUrl = page.url();
            const hashAfter = await getDomContentHash(page);
            const domChanged = hashAfter !== hashBefore;

            if (!isSpaLink && !visitedUrls.has(newUrl)) {
              foundNextPage = true;
            } else if (isSpaLink && domChanged) {
              const spaKey = `${newUrl}#spa-page-${visitedUrls.size}`;
              visitedUrls.add(spaKey);
              foundNextPage = true;
            }
          }
        } catch (e) { /* ignore */ }
      }
    }

    if (!foundNextPage) {
      foundNextPage = await detectAndClickLoadMore(page, source);
      if (foundNextPage) {
        const hashAfter = await getDomContentHash(page);
        if (hashAfter === hashBefore) foundNextPage = false;
        else {
          const pageDelay = Math.max(
            (jobDiagnostics && jobDiagnostics.globalRateLimitDelay) || 3000,
            source.delayBetweenPages || 2000
          );
          await page.waitForTimeout(pageDelay);
        }
      }
    }

    if (foundNextPage && visitedUrls.size < maxPages) {
      await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, maxPages, jobDiagnostics, brokenSelectors);
    }
  } catch (error) {
    console.error(`  ⚠️  Error on page ${visitedUrls.size}:`, error.message);
    if (error.message.includes('Anti-bot detection')) throw error;
  }
}

export async function scrapeSourceWithBrowser(browser, source, sourceKey, proxyUrl = null, jobDiagnostics = null, brokenSelectors = [], criteria = {}) {
  const useMock = USE_MOCK_DATA === true || source?.mockMode === true || criteria?.useMockData === true ||
    (criteria && Array.isArray(criteria.mockSources) && criteria.mockSources.includes(sourceKey || source?.key));

  if (useMock) {
    console.log(`🎭 Mock Mode: Returning simulated data for ${sourceKey || source?.key}`);
    return generateMockSourceResult(source, sourceKey || source?.key, criteria);
  }

  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();
  const userAgent = getRandomDesktopUserAgent();
  const contextOptions = getStealthContextOptions(userAgent, resolvedProxyUrl);

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Set up request interceptor to override request headers on every outgoing HTTP request
  // to guarantee consistency with the randomly generated user agent and client hints.
  await page.route('**/*', (route) => {
    try {
      const originalHeaders = route.request().headers();
      const headers = {};
      
      // Filter out HTTP/2 pseudo-headers (keys starting with ':')
      for (const [key, value] of Object.entries(originalHeaders)) {
        if (!key.startsWith(':') && value !== undefined && value !== null) {
          headers[key] = String(value);
        }
      }

      // Enforce the user-agent
      headers['user-agent'] = userAgent;
      headers['User-Agent'] = userAgent;

      // Extract client hints safely
      const secChUa = contextOptions.extraHTTPHeaders?.['Sec-Ch-Ua'];
      const secChUaMobile = contextOptions.extraHTTPHeaders?.['Sec-Ch-Ua-Mobile'];
      const secChUaPlatform = contextOptions.extraHTTPHeaders?.['Sec-Ch-Ua-Platform'];

      if (secChUa) headers['sec-ch-ua'] = secChUa;
      if (secChUaMobile) headers['sec-ch-ua-mobile'] = secChUaMobile;
      if (secChUaPlatform) headers['sec-ch-ua-platform'] = secChUaPlatform;

      // Remove Upgrade-Insecure-Requests for sub-resources (like fonts, scripts) to prevent CORS preflight blocking
      const resourceType = route.request().resourceType();
      if (resourceType !== 'document' && headers['upgrade-insecure-requests']) {
        delete headers['upgrade-insecure-requests'];
      }

      route.continue({ headers }).catch(() => {});
    } catch (e) {
      route.continue().catch(() => {});
    }
  });

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
    } else if (sourceKey === 'yellow-pages') {
      const searchTerms = criteria.signals && criteria.signals.length > 0 ? criteria.signals[0] : 'real estate';
      const normalizedQuery = searchTerms.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      startUrl = `https://www.yellowpages.ae/search/${normalizedQuery}?field=bkeyword`;
    }

    if (jobDiagnostics) {
      jobDiagnostics.currentPageUrl = startUrl;
    }

    await page.goto(startUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
    await resolveCloudflareChallenge(page);
    await checkForBotBlock(page);
    await dismissGoogleConsent(page);

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

    await performInteractiveSearch(page, sourceKey, criteria, brokenSelectors);

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
        }
      } catch (gmErr) { /* ignore */ }
    }

    await simulateHumanBrowsing(page);
    await scrapePageRecursively(page, source, sourceKey, allContent, visitedUrls, source.maxPages || 5, jobDiagnostics, brokenSelectors);

    const combinedContent = allContent.join('\n\n---PAGE BREAK---\n\n');
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
  } finally {
    try {
      await page.close();
    } catch (e) {}
    try {
      await context.close();
    } catch (e) {}
  }
}

export async function scrapeSource(sourceKey, proxyUrl = null) {
  const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ];
  const browser = await launchBrowser({ args: BROWSER_ARGS });
  try {
    const sourceMap = await getSourceConfigMap();
    if (!sourceMap[sourceKey]) {
      throw new Error(`Unknown source key: ${sourceKey}`);
    }
    return await scrapeSourceWithBrowser(browser, sourceMap[sourceKey], sourceKey, proxyUrl);
  } finally {
    if (browser) {
      try {
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
        ]);
      } catch (err) {
        console.error('[Scraper] Error closing browser in scrapeSource:', err.message);
        try {
          const childProcess = browser.process?.();
          if (childProcess) {
            console.warn(`[Scraper] Force-killing browser process ${childProcess.pid} in scrapeSource...`);
            childProcess.kill('SIGKILL');
          }
        } catch (killErr) { /* ignore */ }
      }
    }
  }
}

export async function scrapeMultipleSources(sourceKeys, proxyUrl = null, webhookUrl = null, runId = null, jobDiagnostics = null, criteria = {}, uaeComplianceMode = false, globalRateLimitDelay = 3000) {
  let browser;
  const SECRET = process.env.SCRAPER_SECRET;
  try {
    const BROWSER_ARGS = [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
    browser = await launchBrowser({ args: BROWSER_ARGS });
    console.log('🕵️‍♂️  Browser launched with full stealth init-scripts active');
    if (jobDiagnostics) {
      jobDiagnostics.browserInstance = browser;
      jobDiagnostics.globalRateLimitDelay = globalRateLimitDelay;
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

      const sourceObj = sourceMap[sourceKey];
      if (uaeComplianceMode && sourceObj) {
        const COMPLIANCE_RESTRICTED_DOMAINS = ['bayut.com', 'dubizzle.com', 'propertyfinder.ae'];
        const urlLower = (sourceObj.url || '').toLowerCase();
        const keyLower = (sourceKey || '').toLowerCase();
        
        const isRestricted = COMPLIANCE_RESTRICTED_DOMAINS.some(domain => 
          urlLower.includes(domain) || keyLower.includes(domain.split('.')[0])
        );

        if (isRestricted) {
          console.warn(`[Compliance] Skipping source ${sourceKey} due to anti-scraping / UAE PDPL compliance restrictions.`);
          results.push({
            source: sourceKey,
            status: 'skipped',
            error: `Skipped: Source contains restricted domain with anti-scraping policy under UAE compliance mode.`,
            timestamp: new Date().toISOString()
          });
          
          // Trigger skipped status notification in webhook if webhookUrl is present
          if (webhookUrl && runId) {
            try {
              const axios = (await import('axios')).default;
              await axios.post(webhookUrl, {
                secret: SECRET,
                runId: runId,
                sourceKey: sourceKey,
                skipped: true,
                reason: "Restricted domain under UAE Compliance Mode"
              }, { timeout: 5000 });
            } catch (whErr) {
              console.error(`[Compliance Webhook] Failed to report skipped source:`, whErr.message);
            }
          }
          continue;
        }
      }

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
        console.warn(maskProxyUrl(`⚠️  Stage 1 verification error for ${sourceKey}, proceeding: ${verifyError.message}`));
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

        // Call Gemini
        let enrichedLeads = [];
        let enrichedProjects = [];
        const sourceObj = sourceMap[sourceKey];
        const isProjectSource = sourceObj && (sourceObj.type === 'REAL_ESTATE_PROJECTS' || sourceObj.type === 'OFF_PLAN_DATA');

        if (isProjectSource) {
          if (content.mockData) {
            enrichedProjects = content.projects || [];
          } else {
            try {
              enrichedProjects = await callGeminiForProjects(content);
            } catch (aiErr) {
              console.error(`[ScraperAI] Project enrichment failed for ${sourceKey}:`, aiErr.message);
            }
          }
        } else {
          if (content.mockData) {
            enrichedLeads = content.leads || [];
          } else {
            try {
              enrichedLeads = await callGeminiForLeads(content, criteria || {});
            } catch (aiErr) {
              console.error(`[ScraperAI] Lead enrichment failed for ${sourceKey}:`, aiErr.message);
            }
          }
        }

        // Update database source selector health status with smart verification / fallback checks
        const uniqueIssues = [...new Set(sourceBrokenSelectors)];
        const itemsFoundCount = isProjectSource ? enrichedProjects.length : enrichedLeads.length;

        if (uniqueIssues.length > 0) {
          if (itemsFoundCount > 0) {
            console.log(`[SelectorHealth] Broken selectors detected for ${sourceKey}, but successfully enriched ${itemsFoundCount} items. Keeping/restoring verified status.`);
            try {
              await prisma.sourceConfig.update({
                where: { key: sourceKey },
                data: {
                  verificationStatus: 'verified',
                  interactionsPassed: true,
                  verificationNotes: `Automatic health check warning (some selectors failed, but data extraction succeeded): ${uniqueIssues.join('; ')}`
                }
              });
            } catch (dbErr) {
              console.error(`[SelectorHealth] Failed to update sourceConfig DB for success-with-warnings:`, dbErr.message);
            }
          } else {
            console.warn(`[SelectorHealth] Broken selectors detected for ${sourceKey} and 0 items enriched. Flagging as needs_review:`, uniqueIssues);
            try {
              await prisma.sourceConfig.update({
                where: { key: sourceKey },
                data: {
                  verificationStatus: 'needs_review',
                  interactionsPassed: false,
                  verificationNotes: `Automatic health check failed during scrape: ${uniqueIssues.join('; ')}`
                }
              });
            } catch (dbErr) {
              console.error(`[SelectorHealth] Failed to update sourceConfig DB:`, dbErr.message);
            }
          }
        } else {
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
          } catch (dbErr) { /* ignore */ }
        }

        // Post Webhook
        if (webhookUrl && runId) {
          const webhookPayload = {
            secret: SECRET,
            runId: runId,
            sourceKey: sourceKey,
            selectorIssues: uniqueIssues
          };
          if (isProjectSource) {
            webhookPayload.enrichedProjects = enrichedProjects;
          } else {
            webhookPayload.enrichedLeads = enrichedLeads;
          }

          try {
            await withRetryJS(() => axios.post(webhookUrl, webhookPayload, { timeout: 30000 }), 3, 1000);
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

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Monitor memory
      try {
        const mem = process.memoryUsage();
        const heapUsedMb = mem.heapUsed / 1024 / 1024;
        if (heapUsedMb > 1200) {
          console.warn('[MemoryMonitor] High memory usage. Restarting browser...');
          if (browser) {
            try {
              await Promise.race([
                browser.close(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
              ]);
            } catch (e) {
              console.error('[MemoryMonitor] Error closing browser:', e.message);
              try {
                const childProcess = browser.process?.();
                if (childProcess) {
                  console.warn(`[MemoryMonitor] Force-killing browser process ${childProcess.pid}...`);
                  childProcess.kill('SIGKILL');
                }
              } catch (killErr) { /* ignore */ }
            }
          }
          browser = await launchBrowser({ args: BROWSER_ARGS });
          if (jobDiagnostics) {
            jobDiagnostics.browserInstance = browser;
          }
          if (global.gc) global.gc();
        }
      } catch (memErr) { /* ignore */ }
    }

    console.log(`\n✅ Completed scraping ${results.length} sources`);

    if (webhookUrl && runId) {
      console.log(`[Webhook] Finalizing ScrapeRun: ${runId}`);
      try {
        await withRetryJS(() => axios.post(webhookUrl, {
          secret: SECRET,
          runId: runId,
          isCompletedSignal: true
        }, { timeout: 15000 }), 3, 1000);
      } catch (webhookErr) {
        console.error(`[Webhook] Final completion webhook failed:`, webhookErr.message);
      }
    }

    return results;
  } catch (globalError) {
    const errorMsg = maskProxyUrl(globalError.message || String(globalError));
    console.error(`❌ Global scraper error in scrapeMultipleSources:`, errorMsg);
    if (webhookUrl && runId) {
      try {
        await withRetryJS(() => axios.post(webhookUrl, {
          secret: SECRET,
          runId: runId,
          isFailedSignal: true,
          error: errorMsg
        }, { timeout: 15000 }), 3, 1000);
      } catch (webhookErr) {
        console.error(`[Webhook] Failed to post failure signal:`, webhookErr.message);
      }
    }
    throw globalError;
  } finally {
    if (browser) {
      console.log('[Scraper] Closing browser...');
      try {
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
        ]);
        console.log('[Scraper] Browser closed successfully.');
      } catch (err) {
        console.error('[Scraper] Error closing browser:', err.message);
        try {
          const childProcess = browser.process?.();
          if (childProcess) {
            console.warn(`[Scraper] Force-killing browser process ${childProcess.pid} in scrapeMultipleSources...`);
            childProcess.kill('SIGKILL');
          }
        } catch (killErr) { /* ignore */ }
      }
    }
  }
}
