const baseUrl = 'http://localhost:3001';

async function testScrapeApi() {
  console.log('Logging in...');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@brilliance.ae',
      password: 'admin123'
    })
  });

  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get('set-cookie');
  let cookieHeader = '';
  if (setCookie) {
    const tokenMatch = setCookie.match(/auth_token=([^;]+)/);
    if (tokenMatch) {
      cookieHeader = `auth_token=${tokenMatch[1]}`;
    }
  }

  console.log('Calling /api/scrape...');
  const scrapeRes = await fetch(`${baseUrl}/api/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    },
    body: JSON.stringify({
      sources: ['ahus-canada'],
      criteria: {
        propertyTypes: [],
        budgetMin: 1000000,
        budgetMax: 10000000,
        emirates: [],
        relocated: false,
        excludeRental: true,
        keywords: ''
      }
    })
  });

  console.log('Status:', scrapeRes.status, scrapeRes.statusText);
  const text = await scrapeRes.text();
  console.log('Response body:', text);
}

testScrapeApi().catch(console.error);
