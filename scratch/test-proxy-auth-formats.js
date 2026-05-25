#!/usr/bin/env node
/**
 * Diagnostic test for DataImpulse proxy authentication
 * Tests different credential formats
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envLocalPath = path.resolve(__dirname, '../.env.local');
dotenv.config({ path: envLocalPath });

console.log('\n=== DataImpulse Proxy Diagnostic Test ===\n');

const username = process.env.DATAIMPULSE_PROXY_USERNAME;
const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
const host = process.env.DATAIMPULSE_PROXY_HOST;
const port = process.env.DATAIMPULSE_PROXY_PORT || '823';

console.log('📋 Configured Credentials:');
console.log(`  Username: ${username ? username.substring(0, 10) + '...' : 'NOT SET'}`);
console.log(`  Password: ${password ? '[REDACTED]' : 'NOT SET'}`);
console.log(`  Host: ${host}`);
console.log(`  Port: ${port}\n`);

async function testCredentialsFormat() {
  console.log('🔍 Testing credential formats...\n');

  const formats = [
    {
      name: 'Full URL with embedded credentials',
      buildProxyUrl: () => `http://${username}:${password}@${host}:${port}`
    },
    {
      name: 'Full URL with URL-encoded password',
      buildProxyUrl: () => `http://${username}:${encodeURIComponent(password)}@${host}:${port}`
    },
    {
      name: 'URL with separate auth object',
      buildProxyUrl: () => `http://${host}:${port}`,
      useAuth: true
    }
  ];

  for (const format of formats) {
    console.log(`\n📝 Testing: ${format.name}`);
    
    try {
      const browser = await chromium.launch({ headless: true });
      
      const proxyConfig = {
        server: format.buildProxyUrl()
      };

      if (format.useAuth) {
        proxyConfig.username = username;
        proxyConfig.password = password;
      }

      console.log(`  Proxy server: ${proxyConfig.server}`);
      if (proxyConfig.username) {
        console.log(`  Username: ${proxyConfig.username.substring(0, 10)}...`);
      }

      const context = await browser.newContext({
        proxy: proxyConfig,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      const page = await context.newPage();

      // Intercept the response
      page.on('response', response => {
        console.log(`  Response status: ${response.status()} from ${response.url()}`);
      });

      console.log('  Attempting to fetch...');
      await Promise.race([
        page.goto('https://httpbin.org/ip', {
          timeout: 15000,
          waitUntil: 'networkidle'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 12000)
        )
      ]);

      const content = await page.textContent('body');
      console.log(`  ✅ SUCCESS! Content: ${content?.substring(0, 50)}`);

      await context.close();
      await browser.close();

      return true;
    } catch (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      try { await browser?.close(); } catch (e) {}
    }
  }

  console.log('\n⚠️  All credential formats failed.');
  console.log('\nPossible issues:');
  console.log('  1. Proxy server is not reachable from your network');
  console.log('  2. Credentials are incorrect');
  console.log('  3. Your IP is not whitelisted by DataImpulse');
  console.log('  4. DataImpulse subscription may not be active');
  console.log('\nNext steps:');
  console.log('  1. Verify you can access app.dataimpulse.com');
  console.log('  2. Confirm subscription is active');
  console.log('  3. Check if credentials are correct');
  console.log('  4. Try using gw.dataimpulse.com as host instead of IP\n');
}

testCredentialsFormat().catch(console.error);
