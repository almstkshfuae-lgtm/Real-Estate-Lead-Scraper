import prisma from '../lib/prisma';

async function runTests() {
  console.log('====== LEADPULSE API INTEGRATION TEST ======');
  const baseUrl = 'http://localhost:3000';

  // Test 1: Accessing a protected endpoint without authentication
  console.log('\n[Test 1] Fetching /api/leads without authentication...');
  try {
    const res = await fetch(`${baseUrl}/api/leads`);
    console.log(`Status: ${res.status} ${res.statusText}`);
    
    const contentType = res.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType}`);

    const text = await res.text();
    console.log('Response body:', text);

    if (res.status === 401 && contentType.includes('application/json')) {
      console.log('✅ PASS: Correctly returned clean 401 JSON for unauthorized request!');
    } else {
      console.error('❌ FAIL: Expected 401 JSON response.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 2: Logging in via POST /api/auth/login
  console.log('\n[Test 2] Authenticating via POST /api/auth/login...');
  let cookieHeader = '';
  try {
    const payload = {
      email: 'admin@brilliance.ae',
      password: 'admin123'
    };

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('User Profile:', data);

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      console.log('Found Set-Cookie:', setCookie.substring(0, 50) + '...');
      // Extract the auth_token cookie
      const tokenMatch = setCookie.match(/auth_token=([^;]+)/);
      if (tokenMatch) {
        cookieHeader = `auth_token=${tokenMatch[1]}`;
      }
    }

    if (res.status === 200 && cookieHeader) {
      console.log('✅ PASS: Successfully authenticated and extracted session token!');
    } else {
      console.error('❌ FAIL: Authentication failed or no cookie returned.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
    process.exit(1);
  }

  // Test 3: Fetching /api/auth/me with active session cookie
  console.log('\n[Test 3] Fetching /api/auth/me with active session...');
  try {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: cookieHeader }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Auth Me Profile:', data);

    if (res.status === 200 && data.user) {
      console.log('✅ PASS: Correctly verified active session details!');
    } else {
      console.error('❌ FAIL: Expected 200 user details.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 4: Fetching /api/leads with active session cookie
  console.log('\n[Test 4] Fetching /api/leads with active session...');
  try {
    const res = await fetch(`${baseUrl}/api/leads`, {
      headers: { Cookie: cookieHeader }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`Leads count returned: ${Array.isArray(data.leads) ? data.leads.length : 0}`);

    if (res.status === 200 && Array.isArray(data.leads)) {
      console.log('✅ PASS: Successfully retrieved leads list!');
    } else {
      console.error('❌ FAIL: Expected 200 leads array.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 5: Verify fallback token extraction from Authorization: Bearer header
  console.log('\n[Test 5] Fetching /api/leads using Authorization: Bearer header fallback...');
  try {
    const token = cookieHeader.replace('auth_token=', '');
    const res = await fetch(`${baseUrl}/api/leads`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`Leads count returned: ${Array.isArray(data.leads) ? data.leads.length : 0}`);

    if (res.status === 200 && Array.isArray(data.leads)) {
      console.log('✅ PASS: Successfully authenticated using Bearer header fallback!');
    } else {
      console.error('❌ FAIL: Expected 200 leads array.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 6: Verify bad token returns clean 401 instead of crashing (500)
  console.log('\n[Test 6] Accessing with a bad token to verify 401 JSON boundary fallback...');
  try {
    const res = await fetch(`${baseUrl}/api/leads`, {
      headers: { Authorization: 'Bearer invalid-corrupted-token-signature' }
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    console.log('Response body:', text);

    if (res.status === 401 && contentType.includes('application/json') && text.includes('Unauthorized')) {
      console.log('✅ PASS: Boundary catch successfully intercepted error and returned clean 401 JSON!');
    } else {
      console.error('❌ FAIL: Expected boundary to return clean 401 JSON on error.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 7: Fetching /api/ai/pitch (AI Pitch Generator)
  console.log('\n[Test 7] Fetching /api/ai/pitch (AI Pitch Generator)...');
  try {
    const payload = {
      lead: {
        name: 'Ghiath Al-Mansoori',
        company: 'Abu Dhabi Investment Authority',
        role: 'Managing Director',
        score: 93,
        tier: 1,
        signals: ['Executive', 'UHNW'],
        location: 'Abu Dhabi'
      },
      lang: 'en',
      style: 'professional'
    };

    const res = await fetch(`${baseUrl}/api/ai/pitch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Cookie: cookieHeader
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Generated Pitch preview:', data.pitch ? data.pitch.substring(0, 100) + '...' : 'N/A');

    if (res.status === 200 && data.pitch) {
      console.log('✅ PASS: Successfully generated AI pitch for elite HNWI lead!');
    } else {
      console.error('❌ FAIL: Expected 200 and generated pitch.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 8: Fetching /api/ai/chat (True Chatbot SSE Stream)
  console.log('\n[Test 8] Fetching /api/ai/chat (True Chatbot SSE Stream)...');
  try {
    const payload = {
      messages: [{ role: 'user', content: 'What is the best real estate investment area in Abu Dhabi right now?' }],
      lang: 'en'
    };

    const res = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log('Headers Content-Type:', res.headers.get('content-type'));

    if (res.status === 200 && res.body) {
      console.log('Reading SSE Stream chunks...');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let chunksCount = 0;
      let completedCorrectly = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          chunksCount++;
          const chunkText = decoder.decode(value);
          if (chunkText.includes('[DONE]')) {
            completedCorrectly = true;
          }
        }
      }
      
      console.log(`Successfully read ${chunksCount} SSE stream packets!`);
      if (completedCorrectly) {
        console.log('✅ PASS: Correctly processed chatbot SSE stream and captured [DONE] packet!');
      } else {
        console.error('❌ FAIL: Stream did not complete with [DONE] packet.');
      }
    } else {
      console.error('❌ FAIL: Expected 200 SSE streaming response.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  // Test 9: Webhook Security Verification
  console.log('\n[Test 9] POSTing to /api/scrape/webhook with incorrect secret...');
  try {
    const payload = {
      secret: 'wrong-secret-token',
      runId: 'cly4xk2m0000108l4h5z1x9p0',
      isCompletedSignal: true
    };

    const res = await fetch(`${baseUrl}/api/scrape/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log('Response:', data);

    if (res.status === 401 && data.error === 'Unauthorized') {
      console.log('✅ PASS: Correctly rejected webhook request with incorrect secret!');
    } else {
      console.error('❌ FAIL: Expected 401 Unauthorized response.');
    }
  } catch (err: any) {
    console.error('❌ FAIL: Request error:', err.message);
  }

  console.log('\n====== ALL API INTEGRATION TESTS COMPLETED! ======');
}

runTests().catch(console.error);
