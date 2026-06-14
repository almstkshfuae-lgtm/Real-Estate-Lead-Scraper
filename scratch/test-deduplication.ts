import prisma from "../lib/prisma";
import { POST } from "../app/api/scrape/webhook/route";
import { NextRequest } from "next/server";

async function runTest() {
  console.log("=== STARTING DEDUPLICATION TEST ===");

  // 1. Setup a test agent
  let testAgent = await prisma.user.findUnique({
    where: { email: "test-agent@brilliance-lead.uk" }
  });
  if (!testAgent) {
    testAgent = await prisma.user.create({
      data: {
        email: "test-agent@brilliance-lead.uk",
        passwordHash: "$2b$10$xyz",
        name: "Test Agent",
        role: "agent"
      }
    });
  }
  console.log(`Using test agent: ${testAgent.name} (ID: ${testAgent.id})`);

  // 2. Setup a test ScrapeRun
  const scrapeRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: testAgent.id,
      sources: JSON.stringify(["Bayut"]),
      criteria: JSON.stringify({ type: "test" }),
      status: "PROCESSING"
    }
  });
  console.log(`Created scrape run: ${scrapeRun.id}`);

  // Retrieve the secret
  let systemSecret = process.env.SCRAPER_SECRET;
  if (!systemSecret) {
    systemSecret = "96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684";
  }

  // 3. Send Lead 1 (Initial lead) via Webhook
  const lead1Payload = {
    secret: systemSecret,
    runId: scrapeRun.id,
    sourceKey: "bayut",
    enrichedLeads: [
      {
        name: "أحمد المنصوري", // Arabic name with أ
        company: "Gulf Tech Capital",
        role: "Managing Partner",
        source: "Bayut",
        tier: 1,
        phone: "+971-50-1234567",
        email: "ahmad@gulftech.ae",
        location: "Dubai Marina",
        score: 95,
        signals: ["UHNW", "Investor"],
        propertyPref: { type: "penthouse" }
      }
    ]
  };

  console.log("\nSending first lead payload via webhook...");
  const req1 = new NextRequest("http://localhost/api/scrape/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead1Payload)
  });
  const res1 = await POST(req1);
  const data1 = await res1.json();
  console.log("Response 1:", data1);

  // 4. Send Lead 2 (Spelling variation in name, same company) via Webhook
  const lead2Payload = {
    secret: systemSecret,
    runId: scrapeRun.id,
    sourceKey: "bayut",
    enrichedLeads: [
      {
        name: "احمد المنصوري", // Arabic name with ا (variation!)
        company: "Gulf Tech Capital",
        role: "Chief Executive Officer", // Different role
        source: "Dubizzle", // Different source
        tier: 2,
        phone: "+971501234567", // Same phone, different format
        email: "AHMAD@gulftech.ae", // Same email, uppercase
        location: "Palm Jumeirah",
        score: 98, // Higher score
        signals: ["High Net Worth"],
        propertyPref: { type: "villa" }
      }
    ]
  };

  console.log("\nSending second duplicate/variant lead payload via webhook...");
  const req2 = new NextRequest("http://localhost/api/scrape/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead2Payload)
  });
  const res2 = await POST(req2);
  const data2 = await res2.json();
  console.log("Response 2:", data2);

  // 5. Query leads for this agent to verify only one exists and has merged properties
  const agentLeads = await prisma.lead.findMany({
    where: {
      agentId: testAgent.id,
      deletedAt: null
    },
    include: {
      scrapeRuns: true
    }
  });

  console.log("\n=== VERIFICATION RESULTS ===");
  console.log(`Total lead records created: ${agentLeads.length}`);

  if (agentLeads.length === 1) {
    const lead = agentLeads[0];
    console.log("✅ SUCCESS: Only 1 lead record was created!");
    console.log(`Lead Name: "${lead.name}" (Name in DB)`);
    console.log(`Lead Company: "${lead.company}"`);
    console.log(`Merged Source: "${lead.source}" (Should contain both Bayut and Dubizzle)`);
    console.log(`Merged Score: ${lead.score} (Should be max: 98)`);
    console.log(`Merged Email: "${lead.email}"`);
    console.log(`Merged Phone: "${lead.phone}"`);
    console.log(`Associated Scrape Runs Count: ${lead.scrapeRuns.length}`);

    if (lead.scrapeRuns.length === 1) {
      console.log("✅ SUCCESS: Lead linked to scrape run!");
    } else {
      console.log("❌ FAILURE: Expected 1 linked scrape run, got:", lead.scrapeRuns.length);
    }
  } else {
    console.log("❌ FAILURE: Expected 1 lead record, but found:", agentLeads.length);
    for (const l of agentLeads) {
      console.log(`  - Lead ID: ${l.id}, Name: "${l.name}", Source: "${l.source}"`);
    }
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await prisma.leadScrapeRun.deleteMany({
    where: { scrapeRunId: scrapeRun.id }
  });
  await prisma.lead.deleteMany({
    where: { agentId: testAgent.id }
  });
  await prisma.scrapeRun.deleteMany({
    where: { id: scrapeRun.id }
  });
  await prisma.user.delete({
    where: { id: testAgent.id }
  });
  console.log("Cleanup complete!");
  console.log("=== TEST FINISHED ===");
}

runTest()
  .catch((err) => {
    console.error("Test failed with error:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
