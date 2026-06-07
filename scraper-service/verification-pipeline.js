import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { maskProxyUrl } from './proxy-validator.js';

async function dismissGoogleConsent(page) {
  const url = page.url();
  if (url.includes('consent.google.') || url.includes('google.com/consent') || url.includes('consent.youtube.')) {
    console.log('[Stealth] Google Consent redirect page detected during verification. Dismissing...');
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
          await btn.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
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

// ─── Advanced Stealth Overrides ───────────────────────────────────────────────
// Applied to every new page context to defeat Cloudflare/Turnstile bot detection.
// Covers: webdriver flag, chrome runtime object, permissions API, plugins,
// languages, WebGL vendor/renderer, screen properties, and hardware concurrency.
export async function applyStealthOverrides(page) {
  await page.addInitScript(() => {
    // 1. Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. Simulate real Chrome runtime
    window.chrome = {
      app: {
        isInstalled: false,
        InstallState: { DISABLED: 'DISABLED', INSTALLED: 'INSTALLED', NOT_INSTALLED: 'NOT_INSTALLED' },
        RunningState: { CANNOT_RUN: 'CANNOT_RUN', RUNNING: 'RUNNING', CAN_RUN: 'CAN_RUN' }
      },
      runtime: {
        onConnect: { addListener: () => { } },
        onMessage: { addListener: () => { } }
      }
    };

    // 3. Fix permissions API (Cloudflare checks this)
    const originalQuery = window.navigator.permissions.query.bind(navigator.permissions);
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // 4. Simulate realistic plugin list
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const makePlugin = (name, desc, filename) =>
          Object.create(Plugin.prototype, {
            name: { value: name }, description: { value: desc }, filename: { value: filename }, length: { value: 1 }
          });
        const arr = [
          makePlugin('Chrome PDF Plugin', 'Portable Document Format', 'internal-pdf-viewer'),
          makePlugin('Chrome PDF Viewer', '', 'mhjfbmdgcfjbbpaeojofohoefgiehjai'),
          makePlugin('Native Client', '', 'internal-nacl-plugin')
        ];
        arr.item = (i) => arr[i];
        arr.namedItem = (name) => arr.find(p => p.name === name) || null;
        arr.refresh = () => { };
        return arr;
      }
    });

    // 5. Languages
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en', 'ar-AE', 'ar'] });

    // 6. WebGL fingerprint masking
    const getParameterProxied = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return 'Intel Inc.';       // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameterProxied.call(this, parameter);
    };

    // 7. Screen and hardware realism
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

    // Note: Overriding HTMLIFrameElement.prototype.contentWindow was removed as it acts as an obvious bot detection trigger.
  });
}

/**
 * Attempt to solve/bypass Cloudflare Turnstile or JS challenges on the page.
 * Waits for challenge to appear, clicks the checkbox if present, and waits for resolution.
 */
export async function resolveCloudflareChallenge(page, timeoutMs = 20000) {
  const startTime = Date.now();
  console.log('[AntiBot] Checking for Cloudflare/Turnstile challenge...');
  
  // Wait a moment for dynamic challenge to load
  await page.waitForTimeout(2000);

  const isChallengePresent = async () => {
    try {
      const html = await page.content();
      const title = await page.title();
      const url = page.url();

      return (
        html.includes('cf-challenge') ||
        html.includes('cloudflare-challenge') ||
        html.includes('verify you are human') ||
        html.includes('checking your browser') ||
        url.includes('challenge-platform') ||
        title.includes('Just a moment...')
      );
    } catch (e) {
      return false;
    }
  };

  if (!(await isChallengePresent())) {
    console.log('[AntiBot] No Cloudflare challenge detected.');
    return false;
  }

  console.log('[AntiBot] Cloudflare Turnstile or JS challenge detected! Attempting automatic bypass...');

  // Loop checking/solving until resolved or timeout
  while (Date.now() - startTime < timeoutMs) {
    if (!(await isChallengePresent())) {
      console.log('[AntiBot] Cloudflare challenge resolved successfully!');
      return true;
    }

    // Try finding Turnstile iframe
    const cfFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com') || f.name().includes('cf-'));
    
    if (cfFrame) {
      console.log('[AntiBot] Found Cloudflare challenges iframe.');
      try {
        // Look for checkbox container or input
        const checkbox = await cfFrame.$('input[type="checkbox"], #challenge-stage, .cb-i, .mark');
        if (checkbox) {
          console.log('[AntiBot] Found checkbox inside Turnstile iframe. Attempting click...');
          await checkbox.click({ timeout: 3000 });
          console.log('[AntiBot] Clicked Turnstile checkbox inside iframe.');
        } else {
          // coordinate click fallback on the iframe element
          const iframeElement = await page.$('iframe[src*="challenges.cloudflare.com"], iframe[id*="cf-"]');
          if (iframeElement) {
            const box = await iframeElement.boundingBox();
            if (box) {
              const clickX = box.x + 30;
              const clickY = box.y + box.height / 2;
              await page.mouse.click(clickX, clickY);
              console.log(`[AntiBot] Clicked iframe at coordinate coordinates (${clickX}, ${clickY}).`);
            }
          }
        }
      } catch (err) {
        console.warn(`[AntiBot] Error interacting with Turnstile iframe: ${err.message}`);
        try {
          const iframeElement = await page.$('iframe[src*="challenges.cloudflare.com"], iframe[id*="cf-"]');
          if (iframeElement) {
            const box = await iframeElement.boundingBox();
            if (box) {
              const clickX = box.x + 30;
              const clickY = box.y + box.height / 2;
              await page.mouse.click(clickX, clickY);
              console.log(`[AntiBot] Fallback coordinate click successful at (${clickX}, ${clickY}).`);
            }
          }
        } catch (innerErr) {
          // ignore
        }
      }
    }

    await page.waitForTimeout(2500);
  }

  // Final check
  if (!(await isChallengePresent())) {
    console.log('[AntiBot] Cloudflare challenge resolved successfully!');
    return true;
  }

  console.warn('[AntiBot] Cloudflare Turnstile solve timed out.');
  return false;
}

function getPlaywrightProxyOptions(proxyUrl) {
  if (!proxyUrl) return null;
  
  if (process.env.ACTIVE_PROXY_PROVIDER === 'dataimpulse' || process.env.DATAIMPULSE_PROXY_USERNAME) {
    const username = process.env.DATAIMPULSE_PROXY_USERNAME;
    const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
    const host = process.env.DATAIMPULSE_PROXY_HOST || 'gw.dataimpulse.com';
    const port = process.env.DATAIMPULSE_PROXY_PORT || '823';
    
    if (username && password) {
      return {
        server: `http://${host}:${port}`,
        username,
        password
      };
    }
  }

  try {
    const url = new URL(proxyUrl);
    const options = {
      server: `${url.protocol}//${url.host}`
    };
    if (url.username) {
      options.username = decodeURIComponent(url.username);
    }
    if (url.password) {
      options.password = decodeURIComponent(url.password);
    }
    return options;
  } catch (e) {
    return { server: proxyUrl };
  }
}

/**
 * Creates a browser context and page with top-tier stealth overrides and HTTP headers.
 */
async function createStealthContextAndPage(browser, proxyUrl = null) {
  const proxyOptions = getPlaywrightProxyOptions(proxyUrl);
  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
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
  if (proxyOptions) {
    contextOptions.proxy = proxyOptions;
  }
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  
  // Apply stealth overrides
  await applyStealthOverrides(page);

  // Block heavy assets to prevent timeouts
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const blockedTypes = ['image', 'font', 'media'];
    if (blockedTypes.includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  return { context, page };
}

/**
 * Data Extraction Source Verification Pipeline
 * 
 * Ensures new sources pass 4 critical verification stages before integration:
 * 1. Technical Access Test (Playwright + Proxy + Block Detection)
 * 2. DOM Data Verification (Required Lead Schema Fields)
 * 3. Interaction Mapping (Navigation Selectors Detection)
 * 4. AI Extraction Viability Test (AI Model Compatibility)
 */

const getCloudflareIndicators = () => {
  const envVal = process.env.CLOUDFLARE_INDICATORS || '';
  if (envVal.trim()) {
    return envVal.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [
    'cf_challenge',
    'cf_clearance',
    '__cf_bm',
    'managed_rules',
    'Access Denied',
    'Ray ID'
  ];
};

const getAuthIndicators = () => {
  const envVal = process.env.AUTH_WALL_INDICATORS || '';
  if (envVal.trim()) {
    return envVal.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [
    'login',
    'signin',
    'sign-in',
    'authenticate',
    'register',
    'create account',
    'enter password'
  ];
};

/**
 * Stage 1: Technical Access Test
 * Verifies the URL is accessible without hard blocks
 */
async function technicalAccessTest(url, proxyUrl = null) {
  const testResult = {
    passed: false,
    checks: {
      accessible: false,
      cloudflareDetected: false,
      authWallDetected: false,
      forbidden403: false,
      redirectLoop: false,
      sslError: false
    },
    issues: [],
    statusCode: null,
    finalUrl: null,
    htmlSize: 0,
    loadTime: 0
  };

  let browser;
  try {
    const startTime = Date.now();
    
    const browserOptions = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    };

    const proxyOptions = getPlaywrightProxyOptions(proxyUrl);
    if (proxyOptions) {
      browserOptions.proxy = proxyOptions;
    }

    browser = await chromium.launch({ ...browserOptions, channel: 'msedge' });
    const { context, page } = await createStealthContextAndPage(browser, proxyUrl);

    // Set request/response interception for diagnostics
    let finalStatusCode = 200;
    page.on('response', (response) => {
      finalStatusCode = response.status();
    });

    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await resolveCloudflareChallenge(page);
      await dismissGoogleConsent(page);
      testResult.checks.accessible = true;
    } catch (navError) {
      if (navError.message.includes('403')) {
        testResult.checks.forbidden403 = true;
        testResult.issues.push('HTTP 403 Forbidden - Access Denied');
      } else if (navError.message.includes('ERR_SSL')) {
        testResult.checks.sslError = true;
        testResult.issues.push('SSL Certificate Error');
      } else if (navError.message.includes('too many redirects')) {
        testResult.checks.redirectLoop = true;
        testResult.issues.push('Redirect Loop Detected');
      } else {
        testResult.issues.push(maskProxyUrl(`Navigation failed: ${navError.message}`));
      }
      return testResult;
    }

    testResult.statusCode = finalStatusCode;
    testResult.finalUrl = page.url();
    testResult.loadTime = Date.now() - startTime;

    // Get page content
    const html = await page.content();
    testResult.htmlSize = html.length;

    // Check for Cloudflare
    const cloudflareIndicators = getCloudflareIndicators();
    const cloudflareFound = cloudflareIndicators.some(indicator => 
      html.includes(indicator) || page.url().includes('challenge')
    );
    if (cloudflareFound) {
      testResult.checks.cloudflareDetected = true;
      testResult.issues.push('Cloudflare Turnstile or challenge page detected');
    }

    // Check for authentication walls
    const authIndicators = getAuthIndicators();
    const authFound = authIndicators.some(indicator => 
      html.toLowerCase().includes(indicator)
    );
    // Heuristic: if page is mostly login form, mark as auth wall
    const $ = cheerio.load(html);
    const inputCount = $('input[type="password"], input[type="email"], input[type="username"]').length;
    const formCount = $('form').length;
    
    if (authFound && (inputCount > 0 || (formCount > 0 && html.length < 50000))) {
      testResult.checks.authWallDetected = true;
      testResult.issues.push('Authentication wall or login requirement detected');
    }

    testResult.passed = !testResult.checks.cloudflareDetected && 
                       !testResult.checks.authWallDetected && 
                       !testResult.checks.forbidden403 &&
                       testResult.checks.accessible;

    await context.close();
  } catch (error) {
    testResult.issues.push(maskProxyUrl(`Test Error: ${error.message}`));
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return testResult;
}

/**
 * Stage 2: DOM Data Verification
 * Verifies required Lead schema fields exist in rendered DOM
 */
async function domDataVerification(url, proxyUrl = null) {
  const testResult = {
    passed: false,
    checks: {
      nameFieldFound: false,
      companyFieldFound: false,
      roleFieldFound: false,
      minimalDataPresent: false,
      canvasContentDetected: false,
      iframeContentDetected: false
    },
    issues: [],
    foundPatterns: [],
    sampleElements: [],
    dataQuality: 0
  };

  let browser;
  try {
    const browserOptions = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    };

    const proxyOptions = getPlaywrightProxyOptions(proxyUrl);
    if (proxyOptions) {
      browserOptions.proxy = proxyOptions;
    }

    browser = await chromium.launch({ ...browserOptions, channel: 'msedge' });
    const { context, page } = await createStealthContextAndPage(browser, proxyUrl);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await resolveCloudflareChallenge(page);
    await dismissGoogleConsent(page);

    // Wait for potential dynamic content
    await page.waitForTimeout(2000);

    const html = await page.content();
    const $ = cheerio.load(html);

    // Check for name patterns (required)
    const nameSelectors = [
      '[data-name]',
      '[class*="name"]',
      '[class*="member-name"]',
      'h3[class*="profile"]',
      '.person-name',
      '[data-fullname]'
    ];
    
    let nameFound = false;
    for (const selector of nameSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        nameFound = true;
        testResult.sampleElements.push({
          field: 'name',
          selector: selector,
          count: elements.length,
          sample: elements.first().text().substring(0, 50)
        });
        break;
      }
    }
    testResult.checks.nameFieldFound = nameFound;

    // Check for company patterns
    const companySelectors = [
      '[data-company]',
      '[class*="company"]',
      '[class*="organization"]',
      '[class*="affiliation"]',
      '.company-name',
      '[data-organization]'
    ];
    
    let companyFound = false;
    for (const selector of companySelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        companyFound = true;
        testResult.sampleElements.push({
          field: 'company',
          selector: selector,
          count: elements.length,
          sample: elements.first().text().substring(0, 50)
        });
        break;
      }
    }
    testResult.checks.companyFieldFound = companyFound;

    // Check for role patterns
    const roleSelectors = [
      '[data-role]',
      '[class*="role"]',
      '[class*="position"]',
      '[class*="title"]',
      '[class*="job-title"]',
      '.role-text'
    ];
    
    let roleFound = false;
    for (const selector of roleSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        roleFound = true;
        testResult.sampleElements.push({
          field: 'role',
          selector: selector,
          count: elements.length,
          sample: elements.first().text().substring(0, 50)
        });
        break;
      }
    }
    testResult.checks.roleFieldFound = roleFound;

    // Minimal requirement: Name MUST be found AND (Company OR Role) MUST be found.
    testResult.checks.minimalDataPresent = (nameFound && (companyFound || roleFound));

    // Check for Canvas elements (often used to hide data)
    const canvases = $('canvas');
    if (canvases.length > 0) {
      testResult.checks.canvasContentDetected = true;
      // Report canvas presence as a warning/finding, not a hard issue that blocks passing
      testResult.foundPatterns.push(`Found ${canvases.length} Canvas elements`);
    }

    // Check for iframes (may contain secured content)
    const iframes = $('iframe');
    if (iframes.length > 0) {
      testResult.checks.iframeContentDetected = true;
      // This is a warning, not necessarily a blocker
      testResult.foundPatterns.push(`Found ${iframes.length} iframes - content may not be directly accessible`);
    }

    // Calculate data quality score
    let qualityScore = 0;
    if (testResult.checks.nameFieldFound) qualityScore += 40;
    if (testResult.checks.companyFieldFound) qualityScore += 30;
    if (testResult.checks.roleFieldFound) qualityScore += 30;
    testResult.dataQuality = qualityScore;

    // Canvas detection no longer blocks technical verification
    testResult.passed = testResult.checks.minimalDataPresent;

    if (!testResult.checks.minimalDataPresent) {
      testResult.issues.push('Missing required fields: Name and (Company or Role) and text length is insufficient (< 500 chars)');
    }

    await context.close();
  } catch (error) {
    testResult.issues.push(maskProxyUrl(`DOM Verification Error: ${error.message}`));
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return testResult;
}

/**
 * Stage 3: Interaction Mapping
 * Identifies CSS selectors for navigation and pagination
 */
async function interactionMapping(url, proxyUrl = null) {
  const testResult = {
    passed: true,
    navigationElements: {
      loadMoreButtons: [],
      paginationLinks: [],
      nextButtons: [],
      infiniteScrollIndicators: []
    },
    interactionSelectors: {},
    issues: [],
    warning: false,
    hasUnpredictableSelectors: false
  };

  let browser;
  try {
    const browserOptions = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    };

    const proxyOptions = getPlaywrightProxyOptions(proxyUrl);
    if (proxyOptions) {
      browserOptions.proxy = proxyOptions;
    }

    browser = await chromium.launch({ ...browserOptions, channel: 'msedge' });
    const { context, page } = await createStealthContextAndPage(browser, proxyUrl);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await resolveCloudflareChallenge(page);
    await dismissGoogleConsent(page);

    const html = await page.content();
    const $ = cheerio.load(html);

    // Detect Load More buttons
    const loadMorePatterns = [
      'button:contains("Load More")',
      'button:contains("Show More")',
      'a:contains("Load More")',
      'a:contains("Show More")',
      '[class*="load-more"]',
      '[class*="show-more"]',
      '[data-action*="load"]'
    ];

    for (const selector of loadMorePatterns) {
      const elements = $(selector);
      if (elements.length > 0) {
        testResult.navigationElements.loadMoreButtons.push({
          selector: selector,
          count: elements.length
        });
      }
    }

    // Detect pagination
    const paginationPatterns = [
      '.pagination a',
      'a[rel="next"]',
      '[aria-label*="Next"]',
      '.page-nav a',
      '[class*="pagination"] a',
      '[data-page]'
    ];

    for (const selector of paginationPatterns) {
      const elements = $(selector);
      if (elements.length > 0) {
        testResult.navigationElements.paginationLinks.push({
          selector: selector,
          count: elements.length
        });
      }
    }

    // Detect next buttons
    const nextPatterns = [
      'button[aria-label*="next"]',
      'a[aria-label*="next"]',
      'button:contains("Next")',
      '[class*="next-btn"]',
      '[class*="btn-next"]'
    ];

    for (const selector of nextPatterns) {
      const elements = $(selector);
      if (elements.length > 0) {
        testResult.navigationElements.nextButtons.push({
          selector: selector,
          count: elements.length
        });
      }
    }

    // Detect infinite scroll patterns
    const infiniteScrollPatterns = [
      '[class*="infinite"]',
      '[class*="lazy-load"]',
      '[data-infinite-scroll]',
      '[class*="scroll-target"]'
    ];

    for (const selector of infiniteScrollPatterns) {
      const elements = $(selector);
      if (elements.length > 0) {
        testResult.navigationElements.infiniteScrollIndicators.push({
          selector: selector,
          count: elements.length
        });
      }
    }

    // Check for unpredictable selectors (dynamically generated)
    const allScripts = $('script').text();
    const hasReactOrVue = allScripts.includes('React') || allScripts.includes('Vue') || allScripts.includes('__NEXT');
    
    if (hasReactOrVue) {
      // Check if selectors use hashes or dynamic IDs
      const hasDynamicIds = $('[id*="__"] , [class*="__"], [id*="--"]').length > 10;
      if (hasDynamicIds) {
        testResult.hasUnpredictableSelectors = true;
        testResult.warning = true;
        testResult.issues.push('Dynamically generated selectors detected - may require manual review for selector stability');
      }
    }

    // Summarize
    const totalSelectors = Object.values(testResult.navigationElements)
      .reduce((sum, arr) => sum + arr.length, 0);
    
    if (totalSelectors === 0) {
      testResult.issues.push('No standard pagination/navigation elements found - may use custom navigation');
      testResult.warning = true;
    }

    testResult.interactionSelectors = {
      loadMore: testResult.navigationElements.loadMoreButtons.map(x => x.selector),
      pagination: testResult.navigationElements.paginationLinks.map(x => x.selector),
      nextButton: testResult.navigationElements.nextButtons.map(x => x.selector),
      infiniteScroll: testResult.navigationElements.infiniteScrollIndicators.map(x => x.selector)
    };

    await context.close();
  } catch (error) {
    testResult.issues.push(maskProxyUrl(`Interaction Mapping Error: ${error.message}`));
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return testResult;
}

/**
 * Stage 4: AI Extraction Viability Test
 * Tests if AI model can successfully extract structured data
 */
async function aiExtractionViabilityTest(url, proxyUrl = null, aiExtractionFn = null) {
  const testResult = {
    passed: false,
    extractionTest: {
      sampleObtained: false,
      sampleSize: 0,
      extractionSuccessful: false,
      hallucinations: []
    },
    issues: [],
    sampleText: '',
    extractedData: null,
    confidence: 0
  };

  let browser;
  try {
    const browserOptions = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    };

    const proxyOptions = getPlaywrightProxyOptions(proxyUrl);
    if (proxyOptions) {
      browserOptions.proxy = proxyOptions;
    }

    browser = await chromium.launch({ ...browserOptions, channel: 'msedge' });
    const { context, page } = await createStealthContextAndPage(browser, proxyUrl);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await resolveCloudflareChallenge(page);
    await dismissGoogleConsent(page);
    await page.waitForTimeout(2000);

    // Extract clean text from DOM
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Remove non-content elements
    $('script, style, noscript').remove();
    
    // Replace br tags with newlines
    $('br').replaceWith('\n');
    $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, article, section, header, footer, nav, aside').each((i, el) => {
      $(el).prepend(' ').append('\n');
    });

    // Get body text
    let text = $('body').text();
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim()
      .substring(0, 5000); // Limit sample size

    if (text.length >= 50) {
      testResult.extractionTest.sampleObtained = true;
      testResult.extractionTest.sampleSize = text.length;
      testResult.sampleText = text.substring(0, 1000);

      // Try AI extraction if function provided
      if (aiExtractionFn && typeof aiExtractionFn === 'function') {
        try {
          const extractionPrompt = `Extract lead data from this text. Return valid JSON with fields: name, company, role, location.
Only include fields if you are confident they are present in the text.
Do NOT hallucinate data that isn't explicitly mentioned.
Text: ${text}`;

          const extracted = await aiExtractionFn(extractionPrompt);
          
          if (extracted) {
            // Validate extracted data
            if (extracted.name || (extracted.company || extracted.role)) {
              testResult.extractionTest.extractionSuccessful = true;
              testResult.extractedData = extracted;
              
              // Check for hallucinations: validate fields exist in original text
              const originalLower = text.toLowerCase();
              const hallucinations = [];
              
              if (extracted.name && !originalLower.includes(extracted.name.toLowerCase())) {
                hallucinations.push(`name: "${extracted.name}" not found in text`);
              }
              if (extracted.company && !originalLower.includes(extracted.company.toLowerCase())) {
                hallucinations.push(`company: "${extracted.company}" not found in text`);
              }
              
              testResult.extractionTest.hallucinations = hallucinations;
              
              // Calculate confidence
              if (hallucinations.length === 0) {
                testResult.confidence = 95;
              } else if (hallucinations.length === 1) {
                testResult.confidence = 70;
              } else {
                testResult.confidence = 40;
              }
            } else {
              testResult.issues.push('AI extraction returned no valid fields');
              testResult.confidence = 0;
            }
          } else {
            testResult.issues.push('AI extraction returned null');
          }
        } catch (aiError) {
          testResult.issues.push(maskProxyUrl(`AI extraction error: ${aiError.message}`));
        }
      } else {
        testResult.issues.push('AI extraction function not provided - skipping viability test');
      }
    } else {
      testResult.issues.push('Insufficient text content for extraction test');
    }

    testResult.passed = testResult.extractionTest.extractionSuccessful && 
                       testResult.extractionTest.hallucinations.length === 0 &&
                       testResult.extractionTest.sampleObtained;

    await context.close();
  } catch (error) {
    testResult.issues.push(maskProxyUrl(`AI Extraction Test Error: ${error.message}`));
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return testResult;
}

/**
 * Complete Verification Pipeline
 * Runs all 4 stages and returns comprehensive report
 */
async function verifySourceCompletePipeline(sourceUrl, proxyUrl = null, aiExtractionFn = null) {
  console.log(`\n🔍 Starting verification pipeline for: ${sourceUrl}`);

  const report = {
    url: sourceUrl,
    timestamp: new Date().toISOString(),
    overallStatus: 'PENDING',
    stages: {},
    summary: {
      totalTests: 4,
      passedTests: 0,
      blockers: [],
      warnings: []
    },
    recommendation: 'REJECTED',
    nextSteps: []
  };

  try {
    // Stage 1: Technical Access
    console.log('📡 Stage 1: Technical Access Test...');
    report.stages.technicalAccess = await technicalAccessTest(sourceUrl, proxyUrl);
    
    if (report.stages.technicalAccess.passed) {
      report.summary.passedTests++;
      console.log('✅ Technical Access: PASSED');
    } else {
      console.log('❌ Technical Access: BLOCKED');
      report.summary.blockers.push(...report.stages.technicalAccess.issues);
    }

    // Stage 2: DOM Data Verification
    console.log('🔍 Stage 2: DOM Data Verification...');
    report.stages.domData = await domDataVerification(sourceUrl, proxyUrl);
    
    if (report.stages.domData.passed) {
      report.summary.passedTests++;
      console.log('✅ DOM Data Verification: PASSED');
    } else {
      console.log('❌ DOM Data Verification: FAILED');
      report.summary.blockers.push(...report.stages.domData.issues);
    }

    // Stage 3: Interaction Mapping
    console.log('🗺️  Stage 3: Interaction Mapping...');
    report.stages.interactionMapping = await interactionMapping(sourceUrl, proxyUrl);
    
    if (!report.stages.interactionMapping.warning) {
      report.summary.passedTests++;
      console.log('✅ Interaction Mapping: PASSED');
    } else {
      console.log('⚠️  Interaction Mapping: WARNING');
      report.summary.warnings.push(...report.stages.interactionMapping.issues);
    }

    // Stage 4: AI Extraction Viability
    console.log('🤖 Stage 4: AI Extraction Viability Test...');
    report.stages.aiExtraction = await aiExtractionViabilityTest(sourceUrl, proxyUrl, aiExtractionFn);
    
    if (report.stages.aiExtraction.passed) {
      report.summary.passedTests++;
      console.log('✅ AI Extraction: PASSED');
    } else {
      console.log('⚠️  AI Extraction: WARNING/MANUAL REVIEW');
      report.summary.warnings.push(...report.stages.aiExtraction.issues);
    }

    // Make final recommendation
    if (report.summary.blockers.length === 0 && report.summary.passedTests >= 3) {
      report.overallStatus = 'APPROVED';
      report.recommendation = 'APPROVED_FOR_INTEGRATION';
      report.nextSteps = ['Create source profile', 'Add to database', 'Schedule periodic verification'];
    } else if (report.summary.blockers.length > 0) {
      report.overallStatus = 'REJECTED';
      report.recommendation = 'REJECTED_HARD_BLOCKS';
      report.nextSteps = ['Address blocking issues', 'Find alternative source', 'Contact site administrator'];
    } else if (report.summary.warnings.length > 0) {
      report.overallStatus = 'MANUAL_REVIEW_REQUIRED';
      report.recommendation = 'FLAGGED_FOR_MANUAL_REVIEW';
      report.nextSteps = ['Manual testing required', 'Review dynamic selectors', 'Validate AI extraction samples'];
    }

    console.log(`\n📋 Pipeline Summary:`);
    console.log(`   Status: ${report.overallStatus}`);
    console.log(`   Passed Tests: ${report.summary.passedTests}/${report.summary.totalTests}`);
    console.log(`   Blockers: ${report.summary.blockers.length}`);
    console.log(`   Warnings: ${report.summary.warnings.length}`);
    console.log(`   Recommendation: ${report.recommendation}\n`);

  } catch (error) {
    console.error('❌ Pipeline Error:', maskProxyUrl(error.message || String(error)));
    report.overallStatus = 'ERROR';
    report.recommendation = 'FAILED_PIPELINE_ERROR';
    report.summary.blockers.push(maskProxyUrl(error.message || String(error)));
  }

  return report;
}

export {
  technicalAccessTest,
  domDataVerification,
  interactionMapping,
  aiExtractionViabilityTest,
  verifySourceCompletePipeline
};
