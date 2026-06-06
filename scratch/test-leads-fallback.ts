import { createToken } from "../lib/auth.js";
import dotenv from "dotenv";

dotenv.config();

async function runLeadsTest() {
  console.log("Starting Leads Query fallback test...");

  // 1. Generate JWT for an agent
  const agentUser = {
    id: "cmq2nbngr00007b2fl4x50474", // Agent ID from database
    email: "agent@brilliance.ae",
    role: "agent"
  };
  const token = await createToken(agentUser);
  console.log("Token:", token);

  const url = `http://127.0.0.1:3009/api/leads?search=NonExistingLeadName_${Date.now()}`;
  console.log(`Sending GET request to: ${url}...`);

  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  console.log("Response status:", res.status);
  if (!res.ok) {
    const text = await res.text();
    console.error("Error body:", text);
    return;
  }

  const data = await res.json();
  console.log("\n--- API Response Payload ---");
  console.log(JSON.stringify(data, null, 2));

  // Assertions
  if (Array.isArray(data.leads) && data.leads.length === 0 && data.total === 0 && data.isMatchedFallback === false) {
    console.log("\n✅ SUCCESS: API correctly returned empty results and respected the search filters!");
  } else {
    console.error("\n❌ FAILURE: API still returned fallback admin leads or did not return expected response!");
  }
}

runLeadsTest().catch(console.error);
