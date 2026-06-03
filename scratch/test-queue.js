

const SERVICE_URL = 'http://localhost:3002';
const SECRET = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testQueue() {
  console.log('🤖 Starting queue integration test...');

  // 1. Health check
  try {
    const health = await fetch(`${SERVICE_URL}/health`);
    console.log('🏥 Health status:', health.status);
  } catch (err) {
    console.error('❌ Scraper service is not running on port 3002:', err.message);
    process.exit(1);
  }

  // 2. Trigger job 1 (difc)
  console.log('🚀 Triggering Job 1...');
  const res1 = await fetch(`${SERVICE_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sources: ['difc'],
      secret: SECRET,
      runId: 'test-run-1',
      webhookUrl: 'http://localhost:3000/api/scrape/webhook'
    })
  });
  const data1 = await res1.json();
  console.log('Job 1 response:', data1);

  // 3. Immediately trigger job 2 (adgm)
  console.log('🚀 Triggering Job 2...');
  const res2 = await fetch(`${SERVICE_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sources: ['adgm'],
      secret: SECRET,
      runId: 'test-run-2',
      webhookUrl: 'http://localhost:3000/api/scrape/webhook'
    })
  });
  const data2 = await res2.json();
  console.log('Job 2 response:', data2);

  // 4. Poll queue status a few times
  for (let i = 0; i < 5; i++) {
    await delay(1500);
    console.log(`\n🔍 Checking Queue Status (Poll ${i + 1}/5)...`);
    const qRes = await fetch(`${SERVICE_URL}/queue`);
    const qData = await qRes.json();
    console.log(JSON.stringify(qData, null, 2));
  }
}

testQueue().catch(console.error);
