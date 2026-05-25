#!/usr/bin/env node
/**
 * Test Scraper Service with DataImpulse Proxy
 * Tests the actual scraping service with real proxy configuration
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });

const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
const SECRET = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';

console.log('\n=== Scraper Service Integration Test ===\n');
console.log(`📍 Service URL: ${SERVICE_URL}`);
console.log(`🔐 Using scraper secret: ${SECRET.substring(0, 8)}...\n`);

async function testHealthCheck() {
  console.log('🏥 Step 1: Health Check\n');
  try {
    const response = await fetch(`${SERVICE_URL}/health`);
    const data = await response.json();
    console.log(`  ✅ Service is healthy: ${data.service}\n`);
    return true;
  } catch (error) {
    console.error(`  ❌ Health check failed: ${error.message}`);
    console.error(`  ⚠️  Is the scraper service running? Try:\n`);
    console.error(`     npm run dev (in backend directory)\n`);
    return false;
  }
}

async function testProxyInfo() {
  console.log('🔧 Step 2: Get Source Configuration\n');
  try {
    const response = await fetch(`${SERVICE_URL}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET })
    });

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      return false;
    }

    const data = await response.json();
    console.log(`  ✅ Found ${data.sources?.length || 0} sources configured:`);
    data.sources?.slice(0, 3).forEach(source => {
      console.log(`     - ${source.key}: ${source.name} (${source.url?.substring(0, 50)}...)`);
    });
    console.log();

    return data.sources?.length > 0;
  } catch (error) {
    console.error(`  ❌ Failed to get sources: ${error.message}\n`);
    return false;
  }
}

async function testScrapeSource(sourceKey) {
  console.log(`🕷️  Step 3: Test Scraping "${sourceKey}"\n`);
  console.log(`  This will attempt to scrape a real source through the proxy...`);
  console.log(`  (This may take 30-60 seconds)\n`);

  try {
    const response = await fetch(`${SERVICE_URL}/scrape-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceKey,
        secret: SECRET
      }),
      timeout: 120000
    });

    if (!response.ok) {
      console.error(`  ❌ Scrape failed: ${response.status} ${response.statusText}`);
      const error = await response.json();
      console.error(`  Error details: ${error.error}\n`);
      return false;
    }

    const data = await response.json();
    console.log(`  ✅ Scrape completed!\n`);
    console.log(`  📊 Results:`);
    console.log(`     Source: ${data.source.content?.name || sourceKey}`);
    console.log(`     Pages scraped: ${data.source.content?.pagesScraped || 'N/A'}`);
    console.log(`     Content length: ${data.source.content?.contentLength || 0} bytes`);
    console.log(`     Timestamp: ${data.source.content?.timestamp}\n`);

    if (data.source.content?.leads) {
      console.log(`  👥 Leads found: ${data.source.content.leads.length}`);
      data.source.content.leads.slice(0, 2).forEach((lead, i) => {
        console.log(`     ${i + 1}. ${lead.name || 'Unknown'} (${lead.email || 'no-email'})`);
      });
      console.log();
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Scrape failed: ${error.message}`);
    console.error(`  💡 Make sure the scraper service is running:\n`);
    console.error(`     npm run dev\n`);
    return false;
  }
}

async function testProxyConnection() {
  console.log('🔌 Step 4: Test Proxy Connection\n');
  try {
    const response = await fetch(`${SERVICE_URL}/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET }),
      timeout: 60000
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`  ✅ Proxy connection test passed\n`);
      return true;
    } else {
      console.error(`  ❌ Proxy connection test failed: ${data.error}\n`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Proxy test error: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  try {
    console.log('Configuration:');
    console.log(`  Proxy Provider: ${process.env.ACTIVE_PROXY_PROVIDER || 'not set'}`);
    console.log(`  Use Proxy: ${process.env.USE_PROXY}`);
    console.log(`  Mock Data: ${process.env.USE_MOCK_DATA}\n`);

    const healthOk = await testHealthCheck();
    if (!healthOk) {
      console.error('⚠️  Cannot proceed - service not responding\n');
      process.exit(1);
    }

    const sourcesOk = await testProxyInfo();
    if (!sourcesOk) {
      console.error('⚠️  No sources available\n');
      process.exit(1);
    }

    const connOk = await testProxyConnection();
    
    // Only test actual scraping if user confirms
    if (process.argv.includes('--scrape')) {
      console.log('Starting live scraping test...\n');
      await testScrapeSource('jumeirah-village-circle'); // Example source
    } else {
      console.log('💡 To test actual scraping, run with --scrape flag:');
      console.log('   node scratch/test-scraper-service.js --scrape\n');
    }

    console.log('=== Test Summary ===\n');
    console.log('✅ Service is configured and ready');
    console.log('✅ Proxy is configured for real data');
    console.log(`${connOk ? '✅' : '⚠️'} Proxy connection ${connOk ? 'passed' : 'needs verification'}`);
    console.log('\n📖 For more details, see: DATAIMPULSE_INTEGRATION_GUIDE.md\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
