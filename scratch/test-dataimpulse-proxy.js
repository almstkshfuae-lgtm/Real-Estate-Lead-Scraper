#!/usr/bin/env node
/**
 * Test DataImpulse Proxy Connection
 * Verifies credentials, tests connectivity, and validates data egress
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

console.log('\n=== DataImpulse Proxy Configuration Test ===\n');

// Step 1: Verify credentials are loaded
function verifyCredentials() {
  console.log('📋 Step 1: Verifying Credentials\n');

  const credentials = {
    DATAIMPULSE_PROXY_USERNAME: process.env.DATAIMPULSE_PROXY_USERNAME,
    DATAIMPULSE_PROXY_PASSWORD: process.env.DATAIMPULSE_PROXY_PASSWORD,
    DATAIMPULSE_PROXY_HOST: process.env.DATAIMPULSE_PROXY_HOST,
    DATAIMPULSE_PROXY_PORT: process.env.DATAIMPULSE_PROXY_PORT,
    DATAIMPULSE_PROXY_URL: process.env.DATAIMPULSE_PROXY_URL,
  };

  let allValid = true;
  for (const [key, value] of Object.entries(credentials)) {
    if (value) {
      const masked = key.includes('PASSWORD') || key.includes('USERNAME') || key.includes('URL') 
        ? '[REDACTED]' 
        : value;
      console.log(`  ✅ ${key}: ${masked}`);
    } else {
      console.log(`  ❌ ${key}: NOT SET`);
      allValid = false;
    }
  }

  if (!allValid) {
    console.error('\n❌ Missing required credentials!');
    process.exit(1);
  }

  console.log('\n✅ All credentials are set\n');
  return true;
}

// Step 2: Build proxy URL
function buildProxyUrl() {
  console.log('🔨 Step 2: Building Proxy URL\n');

  let proxyUrl;
  if (process.env.DATAIMPULSE_PROXY_URL) {
    proxyUrl = process.env.DATAIMPULSE_PROXY_URL;
    console.log('  Using DATAIMPULSE_PROXY_URL from env');
  } else {
    const username = process.env.DATAIMPULSE_PROXY_USERNAME;
    const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
    const host = process.env.DATAIMPULSE_PROXY_HOST;
    const port = process.env.DATAIMPULSE_PROXY_PORT || '823';
    const scheme = process.env.DATAIMPULSE_PROXY_SCHEME || 'http';

    const encodedUser = encodeURIComponent(username);
    const encodedPass = encodeURIComponent(password);
    proxyUrl = `${scheme}://${encodedUser}:${encodedPass}@${host}:${port}`;
    console.log('  Built proxy URL from individual components');
  }

  const maskedUrl = proxyUrl.replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/, '$1$2:[REDACTED]@');
  console.log(`  📍 Proxy URL: ${maskedUrl}\n`);

  return proxyUrl;
}

// Step 3: Test proxy connectivity with Playwright
async function testProxyConnectivity(proxyUrl) {
  console.log('🌐 Step 3: Testing Proxy Connectivity with Playwright\n');

  let browser;
  try {
    // Launch browser
    console.log('  Starting Chromium browser...');
    browser = await chromium.launch({ headless: true });

    // Create context with proxy
    console.log('  Creating browser context with proxy...');
    const context = await browser.newContext({
      proxy: { server: proxyUrl },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Test basic connectivity
    console.log('  Testing basic connectivity to httpbin.org/ip...');
    await page.goto('https://httpbin.org/ip', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const responseText = await page.textContent('body');
    console.log(`  ✅ Response: ${responseText?.substring(0, 100)}\n`);

    // Parse IP response
    let ipData;
    try {
      ipData = JSON.parse(responseText);
      console.log(`  🌍 Your proxied IP: ${ipData.origin || ipData.ip || 'Unknown'}\n`);
    } catch (e) {
      console.log(`  ⚠️  Could not parse IP response: ${responseText?.substring(0, 50)}\n`);
    }

    await context.close();
    return true;
  } catch (error) {
    console.error(`  ❌ Connectivity test failed: ${error.message}\n`);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Step 4: Compare direct vs proxied egress
async function testEgress() {
  console.log('📊 Step 4: Testing IP Egress (Direct vs Proxied)\n');

  let directIp = 'Unknown';
  let proxiedIp = 'Unknown';

  try {
    // Get direct IP
    console.log('  Testing direct connection (no proxy)...');
    const directResp = await fetch('https://api.ipify.org?format=json', { 
      cache: 'no-store',
      redirect: 'follow'
    });
    if (directResp.ok) {
      const body = await directResp.json();
      directIp = body.ip || 'Unknown';
      console.log(`  ✅ Direct IP: ${directIp}`);
    }
  } catch (e) {
    console.error(`  ❌ Direct IP test failed: ${e.message}`);
  }

  try {
    // Get proxied IP
    const proxyUrl = buildProxyUrl();
    console.log('  Testing proxied connection...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      proxy: { server: proxyUrl }
    });
    const page = await context.newPage();

    await page.goto('https://api.ipify.org?format=json', {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const text = await page.textContent('body');
    if (text) {
      const parsed = JSON.parse(text);
      proxiedIp = parsed.ip || 'Unknown';
      console.log(`  ✅ Proxied IP: ${proxiedIp}`);
    }

    await context.close();
    await browser.close();
  } catch (e) {
    console.error(`  ❌ Proxied IP test failed: ${e.message}`);
  }

  console.log('\n  📍 Egress Comparison:');
  console.log(`     Direct:  ${directIp}`);
  console.log(`     Proxied: ${proxiedIp}`);
  console.log(`     Status:  ${directIp !== proxiedIp ? '✅ Different IPs (proxy working!)' : '❌ Same IP (proxy not routing)'}\n`);

  return directIp !== proxiedIp;
}

// Step 5: Test real-world scraping scenario
async function testScrapingScenario() {
  console.log('🕷️  Step 5: Testing Real-World Scraping Scenario\n');

  const testUrl = 'https://httpbin.org/user-agent';
  const proxyUrl = buildProxyUrl();

  let browser;
  try {
    console.log(`  Testing scrape of ${testUrl}...`);
    
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      proxy: { server: proxyUrl },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Add request/response logging
    page.on('request', request => {
      console.log(`  📤 Request: ${request.method()} ${request.url()}`);
    });

    page.on('response', response => {
      if (!response.url().includes('google-analytics')) {
        console.log(`  📥 Response: ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(testUrl, {
      timeout: 30000,
      waitUntil: 'domcontentloaded'
    });

    const content = await page.textContent('body');
    console.log(`  ✅ Scraped content: ${content?.substring(0, 80)}\n`);

    await context.close();
    return true;
  } catch (error) {
    console.error(`  ❌ Scraping test failed: ${error.message}\n`);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Main execution
async function runTests() {
  try {
    verifyCredentials();
    const proxyUrl = buildProxyUrl();
    
    const connectivityOk = await testProxyConnectivity(proxyUrl);
    if (!connectivityOk) {
      console.error('⚠️  Proxy connectivity test failed. Continuing with egress test...\n');
    }

    const egressOk = await testEgress();
    
    const scrapingOk = await testScrapingScenario();

    // Summary
    console.log('=== Test Summary ===\n');
    console.log(`  Credentials:  ✅ Valid`);
    console.log(`  Connectivity: ${connectivityOk ? '✅' : '❌'}`);
    console.log(`  Egress:       ${egressOk ? '✅' : '❌'}`);
    console.log(`  Scraping:     ${scrapingOk ? '✅' : '❌'}`);
    console.log(`\n  Overall: ${(connectivityOk && egressOk && scrapingOk) ? '✅ All tests passed!' : '⚠️  Some tests failed'}\n`);

    if (connectivityOk && egressOk && scrapingOk) {
      console.log('🎉 DataImpulse proxy is ready to use!\n');
      process.exit(0);
    } else {
      console.log('⚠️  Please review failed tests above\n');
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Test suite failed: ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
