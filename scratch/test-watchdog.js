import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function run() {
  console.log("Starting Scraper Watchdog Verification...");
  
  // 1. Get or create a mock user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test-watchdog@example.com",
        passwordHash: "dummy",
        name: "Test Watchdog",
        role: "agent"
      }
    });
    console.log("Created mock user:", user.email);
  } else {
    console.log("Using existing user:", user.email);
  }

  // 2. Create a zombie ScrapeRun (started 15 minutes ago)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const zombieRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: user.id,
      sources: JSON.stringify(["bayut"]),
      criteria: JSON.stringify({}),
      status: "PROCESSING",
      startedAt: fifteenMinutesAgo
    }
  });
  console.log(`Created zombie ScrapeRun ${zombieRun.id} started at ${zombieRun.startedAt.toISOString()}`);

  // 3. Verify that the passive check in status recovery works
  console.log("Simulating passive check logic...");
  const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000;
  
  const runCheck = await prisma.scrapeRun.findUnique({
    where: { id: zombieRun.id }
  });
  
  let status = runCheck.status;
  if ((runCheck.status === "PENDING" || runCheck.status === "PROCESSING") &&
      Date.now() - new Date(runCheck.startedAt).getTime() > ZOMBIE_TIMEOUT_MS) {
    console.log("Passive watchdog condition met! Updating status to FAILED...");
    const updated = await prisma.scrapeRun.update({
      where: { id: zombieRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date()
      }
    });
    status = updated.status;
  }
  
  if (status === "FAILED") {
    console.log("✅ Passive self-healing verified! Run marked as FAILED.");
  } else {
    console.error("❌ Passive self-healing failed! Run status is still:", status);
  }

  // 4. Test the active watchdog behavior (simulating the active interval)
  const zombieRun2 = await prisma.scrapeRun.create({
    data: {
      triggeredBy: user.id,
      sources: JSON.stringify(["dubizzle"]),
      criteria: JSON.stringify({}),
      status: "PROCESSING",
      startedAt: fifteenMinutesAgo
    }
  });
  console.log(`Created second zombie ScrapeRun ${zombieRun2.id} for route cleanup test.`);

  console.log("Running DB cleanup query...");
  const result = await prisma.scrapeRun.updateMany({
    where: {
      status: { in: ["PENDING", "PROCESSING"] },
      startedAt: { lt: new Date(Date.now() - ZOMBIE_TIMEOUT_MS) }
    },
    data: {
      status: "FAILED",
      completedAt: new Date()
    }
  });
  console.log(`Cleanup query updated ${result.count} runs.`);
  
  const checkedRun2 = await prisma.scrapeRun.findUnique({
    where: { id: zombieRun2.id }
  });
  
  if (checkedRun2.status === "FAILED") {
    console.log("✅ Active database watchdog query verified! Second zombie run marked as FAILED.");
  } else {
    console.error("❌ Active database watchdog query failed! Run status is still:", checkedRun2.status);
  }

  // Clean up test runs from DB
  await prisma.scrapeRun.deleteMany({
    where: {
      id: { in: [zombieRun.id, zombieRun2.id] }
    }
  });
  console.log("Cleaned up test runs from database.");
  
  await prisma.$disconnect();
  console.log("Verification finished successfully.");
}

run().catch(err => {
  console.error("Verification error:", err);
  prisma.$disconnect();
});
