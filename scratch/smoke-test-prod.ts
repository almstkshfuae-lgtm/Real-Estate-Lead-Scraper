#!/usr/bin/env tsx

const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL;
const vercelUrl = process.env.VERCEL_URL;
const scraperSecret = process.env.SCRAPER_SECRET;

if (!scraperServiceUrl || scraperServiceUrl.trim() === '') {
  console.error('Error: SCRAPER_SERVICE_URL is required as an environment variable.');
  process.exit(1);
}
if (!vercelUrl || vercelUrl.trim() === '') {
  console.error('Error: VERCEL_URL is required as an environment variable.');
  process.exit(1);
}
if (!scraperSecret || scraperSecret.trim() === '') {
  console.error('Error: SCRAPER_SECRET is required as an environment variable.');
  process.exit(1);
}

const normalizeUrl = (url: string) => url.replace(/\/+$/, '');
const healthUrl = `${normalizeUrl(scraperServiceUrl)}/health`;
const apiUrl = `${normalizeUrl(vercelUrl)}/api/scrape`;

async function assertStatus(response: Response, context: string) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${context} failed: ${response.status} ${response.statusText}\n${body}`);
  }
}

async function run() {
  console.log(`Testing scraper service health endpoint: ${healthUrl}`);
  const healthResp = await fetch(healthUrl, { method: 'GET' });
  await assertStatus(healthResp, 'Scraper service health check');
  const healthBody = await healthResp.text();
  console.log('✅ Scraper service health passed. Response:');
  console.log(healthBody);

  console.log(`\nTesting production Vercel /api/scrape endpoint: ${apiUrl}`);
  const payload = {
    source: 'https://example.com',
    query: 'test lead',
    proxyUrl: process.env.OXYLABS_PROXY_URL || '',
    proxyUsername: process.env.OXYLABS_PROXY_USERNAME || '',
    proxyPassword: process.env.OXYLABS_PROXY_PASSWORD || ''
  };

  const scrapeResp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-scraper-secret': scraperSecret
    },
    body: JSON.stringify(payload)
  });

  await assertStatus(scrapeResp, 'Vercel scrape API POST');
  const scrapeJson = await scrapeResp.text();
  console.log('✅ Vercel scrape endpoint returned success.');
  console.log(scrapeJson);
}

run().catch((error) => {
  console.error('Smoke test failed.');
  console.error(error);
  process.exit(1);
});
