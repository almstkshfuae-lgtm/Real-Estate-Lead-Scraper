async function main() {
  const baseUrl = "https://www.brilliance-lead.uk";
  
  console.log("1. Logging in to production...");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@brilliance-lead.uk",
      password: "almstkshf@2030"
    })
  });

  if (!loginRes.ok) {
    console.error("Login failed:", loginRes.status, await loginRes.text());
    return;
  }

  const loginData = await loginRes.json();
  const setCookie = loginRes.headers.get("set-cookie");
  console.log("Login successful! set-cookie:", setCookie);

  // Extract auth_token from Set-Cookie header
  const tokenMatch = setCookie?.match(/auth_token=([^;]+)/);
  if (!tokenMatch) {
    console.error("Could not find auth_token in set-cookie header.");
    return;
  }
  const token = tokenMatch[1];
  console.log("Extracted token.");

  console.log("2. Fetching a lead from production...");
  const leadsRes = await fetch(`${baseUrl}/api/leads?limit=1`, {
    headers: {
      "Cookie": `auth_token=${token}`
    }
  });

  if (!leadsRes.ok) {
    console.error("Fetch leads failed:", leadsRes.status, await leadsRes.text());
    return;
  }

  const leadsData = await leadsRes.json();
  const lead = leadsData.leads?.[0];
  if (!lead) {
    console.error("No leads found in production database.");
    return;
  }

  console.log(`Found lead: "${lead.name}" (id: ${lead.id})`);

  console.log("3. Testing POST /api/ai/score on production...");
  const scoreRes = await fetch(`${baseUrl}/api/ai/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `auth_token=${token}`
    },
    body: JSON.stringify({
      leadId: lead.id
    })
  });

  console.log("Score Status:", scoreRes.status);
  const scoreData = await scoreRes.json();
  console.log("Score Response:", JSON.stringify(scoreData, null, 2));

  console.log("4. Testing POST /api/ai/signals on production...");
  const signalsRes = await fetch(`${baseUrl}/api/ai/signals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `auth_token=${token}`
    },
    body: JSON.stringify({
      leadId: lead.id
    })
  });

  console.log("Signals Status:", signalsRes.status);
  const signalsData = await signalsRes.json();
  console.log("Signals Response:", JSON.stringify(signalsData, null, 2));
}

main().catch(console.error);
