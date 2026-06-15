import prisma from "../lib/prisma";
import { POST } from "../app/api/scrape/webhook/route";
import { NextRequest } from "next/server";

async function runTest() {
  console.log("=== STARTING SELECTOR RESILIENCY TEST ===");

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

  // 2. Setup a test ScrapeRun
  const scrapeRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: testAgent.id,
      sources: JSON.stringify(["adgm"]),
      criteria: JSON.stringify({ type: "test" }),
      status: "PROCESSING"
    }
  });

  // Ensure 'adgm' exists in SourceConfig
  let adgmConfig = await prisma.sourceConfig.findUnique({
    where: { key: "adgm" }
  });
  if (!adgmConfig) {
    adgmConfig = await prisma.sourceConfig.create({
      data: {
        key: "adgm",
        url: "https://www.adgm.com",
        name: "ADGM",
        type: "REGULATORY",
        signals: [],
        navigationSelectors: {},
        contentSelectors: {},
        verificationStatus: "verified"
      }
    });
  } else {
    // Reset to verified
    await prisma.sourceConfig.update({
      where: { key: "adgm" },
      data: { verificationStatus: "verified", interactionsPassed: true }
    });
  }

  let systemSecret = process.env.SCRAPER_SECRET;
  if (!systemSecret) {
    systemSecret = "96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684";
  }

  // TEST case 1: Selector issues present, but data is successfully extracted (leadsFound > 0)
  // Status should remain verified!
  const payload1 = {
    secret: systemSecret,
    runId: scrapeRun.id,
    sourceKey: "adgm",
    selectorIssues: ["Missing some field selector"],
    enrichedLeads: [
      {
        name: "Ahmad Al-Mansouri",
        company: "ADGM Corporate Services",
        role: "Director",
        source: "ADGM",
        tier: 1,
        location: "Abu Dhabi",
        score: 90,
        signals: ["HNW"],
        propertyPref: { type: "apartment" }
      }
    ]
  };

  console.log("\nCase 1: Sending payload with selector issues AND enriched leads...");
  const req1 = new NextRequest("http://localhost/api/scrape/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload1)
  });
  await POST(req1);

  let updatedAdgmConfig = await prisma.sourceConfig.findUnique({ where: { key: "adgm" } });
  console.log(`Config Status: ${updatedAdgmConfig?.verificationStatus} (Should be verified)`);
  if (updatedAdgmConfig?.verificationStatus === "verified") {
    console.log("✅ Case 1 Passed!");
  } else {
    console.error("❌ Case 1 Failed!");
  }

  // TEST case 2: Selector issues present, and ZERO leads/projects extracted
  // Status should become needs_review!
  const payload2 = {
    secret: systemSecret,
    runId: scrapeRun.id,
    sourceKey: "adgm",
    selectorIssues: ["Crucial selector missing"],
    enrichedLeads: []
  };

  console.log("\nCase 2: Sending payload with selector issues AND empty enriched leads...");
  const req2 = new NextRequest("http://localhost/api/scrape/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload2)
  });
  await POST(req2);

  updatedAdgmConfig = await prisma.sourceConfig.findUnique({ where: { key: "adgm" } });
  console.log(`Config Status: ${updatedAdgmConfig?.verificationStatus} (Should be needs_review)`);
  if (updatedAdgmConfig?.verificationStatus === "needs_review") {
    console.log("✅ Case 2 Passed!");
  } else {
    console.error("❌ Case 2 Failed!");
  }

  // Cleanup
  console.log("\nCleaning up test data...");
  await prisma.leadScrapeRun.deleteMany({
    where: { scrapeRunId: scrapeRun.id }
  });
  await prisma.lead.deleteMany({
    where: { agentId: testAgent.id }
  });
  await prisma.auditLog.deleteMany({
    where: { agentId: testAgent.id }
  });
  await prisma.notification.deleteMany({
    where: { agentId: testAgent.id }
  });
  await prisma.scrapeRun.deleteMany({
    where: { id: scrapeRun.id }
  });
  await prisma.user.delete({
    where: { id: testAgent.id }
  });
  console.log("Cleanup complete!");
}

runTest()
  .catch(err => console.error(err))
  .finally(async () => await prisma.$disconnect());
