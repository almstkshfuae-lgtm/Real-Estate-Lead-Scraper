import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

/**
 * Data Extraction Source Verification Pipeline
 * 
 * Ensures new sources pass 4 critical verification stages before integration:
 * 1. Technical Access Test (Playwright + Proxy + Block Detection)
 * 2. DOM Data Verification (Required Lead Schema Fields)
 * 3. Interaction Mapping (Navigation Selectors Detection)
 * 4. AI Extraction Viability Test (AI Model Compatibility)
 */

const CLOUDFLARE_INDICATORS = [
  'cf_challenge',
  'cf_clearance',
  '__cf_bm',
  'managed_rules',
  'Access Denied',
  'Ray ID',
  'Something went wrong'
];

const AUTH_INDICATORS = [
  'login',
  'signin',
  'sign-in',
  'authenticate',
  'register',
  'create account',
  'enter password'
];

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

    if (proxyUrl) {
      browserOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(browserOptions);
    const context = await browser.createBrowserContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

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
    const cloudflareFound = CLOUDFLARE_INDICATORS.some(indicator => 
      html.includes(indicator) || page.url().includes('challenge')
    );
    if (cloudflareFound) {
      testResult.checks.cloudflareDetected = true;
      testResult.issues.push('Cloudflare Turnstile or challenge page detected');
    }

    // Check for authentication walls
    const authFound = AUTH_INDICATORS.some(indicator => 
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
    testResult.issues.push(`Test Error: ${error.message}`);
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

    if (proxyUrl) {
      browserOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(browserOptions);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

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

    // Minimal requirement: Name + (Company OR Role)
    testResult.checks.minimalDataPresent = nameFound && (companyFound || roleFound);

    // Check for Canvas elements (often used to hide data)
    const canvases = $('canvas');
    if (canvases.length > 0) {
      testResult.checks.canvasContentDetected = true;
      testResult.issues.push(`Found ${canvases.length} Canvas elements - data may be rendered client-side`);
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

    testResult.passed = testResult.checks.minimalDataPresent && !testResult.checks.canvasContentDetected;

    if (!testResult.checks.minimalDataPresent) {
      testResult.issues.push('Missing required fields: Name and (Company or Role)');
    }

    await context.close();
  } catch (error) {
    testResult.issues.push(`DOM Verification Error: ${error.message}`);
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

    if (proxyUrl) {
      browserOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(browserOptions);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
    testResult.issues.push(`Interaction Mapping Error: ${error.message}`);
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

    if (proxyUrl) {
      browserOptions.proxy = { server: proxyUrl };
    }

    browser = await chromium.launch(browserOptions);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Extract clean text from DOM
    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Remove non-content elements
    $('script, style, noscript, header, footer, nav, aside, form, svg, canvas, iframe, [role="navigation"]').remove();
    
    // Get body text
    let text = $('body').text();
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim()
      .substring(0, 5000); // Limit sample size

    if (text.length > 100) {
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
          testResult.issues.push(`AI extraction error: ${aiError.message}`);
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
    testResult.issues.push(`AI Extraction Test Error: ${error.message}`);
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
    console.error('❌ Pipeline Error:', error);
    report.overallStatus = 'ERROR';
    report.recommendation = 'FAILED_PIPELINE_ERROR';
    report.summary.blockers.push(error.message);
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
