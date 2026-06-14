import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
  console.log("--- Starting Bulk Import Deduplication & Performance Test ---");
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";

  // 1. Clean up old test leads
  await prisma.lead.deleteMany({
    where: { name: { startsWith: "Static Perf Lead" } }
  });

  // Get or create test user
  let user = await prisma.user.findFirst({
    where: { email: "admin@brilliance-lead.uk" }
  });
  if (!user) {
    user = await prisma.user.findFirst();
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "test.agent@local",
        passwordHash: "dummyhash",
        name: "Test Agent",
        role: "agent"
      }
    });
  }

  // 2. Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 3. Generate 305 STATIC mock leads
  const generateLeads = (modifiedIndices: Set<number> = new Set()) => {
    const list: any[] = [];
    for (let i = 1; i <= 305; i++) {
      list.push({
        name: `Static Perf Lead ${i}`,
        email: `perf.lead.${i}@example.com`,
        phone: modifiedIndices.has(i) ? `+971501111111` : `+971500000000`,
        company: `Static Performance Enterprise ${i}`,
        role: i % 10 === 0 ? "CEO" : i % 5 === 0 ? "Director" : "Investor",
        location: i % 2 === 0 ? "Dubai Marina" : "Abu Dhabi",
        signals: ["High Intent", "Cash Buyer"],
        persona: "Experienced real estate investor."
      });
    }
    return list;
  };

  const PORT = process.env.PORT || 3001;
  const url = `http://localhost:${PORT}/api/leads/import`;

  // Helper to send request
  const sendImportRequest = async (leadsList: any[]) => {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ leads: leadsList })
    });
    const duration = Date.now() - startTime;
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API returned ${response.status}: ${errText}`);
    }
    const data = await response.json();
    return { data, duration };
  };

  // Run 1: Import 305 clean leads
  console.log("\n--- RUN 1: Importing 305 new leads ---");
  const leadsRun1 = generateLeads();
  const run1 = await sendImportRequest(leadsRun1);
  console.log(`Run 1 Duration: ${run1.duration}ms`);
  console.log(`Saved: ${run1.data.savedCount}, Updated: ${run1.data.updatedCount}, Skipped: ${run1.data.skippedCount}`);
  if (run1.data.savedCount !== 305) {
    throw new Error(`Run 1 fail: expected 305 saved, got ${run1.data.savedCount}`);
  }

  // Run 2: Re-import exact same list (should skip all)
  console.log("\n--- RUN 2: Re-importing identical list (should skip all) ---");
  const run2 = await sendImportRequest(leadsRun1);
  console.log(`Run 2 Duration: ${run2.duration}ms`);
  console.log(`Saved: ${run2.data.savedCount}, Updated: ${run2.data.updatedCount}, Skipped: ${run2.data.skippedCount}`);
  if (run2.data.skippedCount !== 305) {
    throw new Error(`Run 2 fail: expected 305 skipped, got ${run2.data.skippedCount}`);
  }
  if (run2.duration > 1500) {
    console.warn("Warning: Run 2 took longer than 1.5 seconds.");
  } else {
    console.log("Pass: Identical re-import processed quickly!");
  }

  // Run 3: Modify 30 leads (should update 30, skip 275)
  console.log("\n--- RUN 3: Modifying 30 leads and re-importing (should update 30, skip 275) ---");
  const modifiedIndices = new Set(Array.from({ length: 30 }, (_, i) => i + 1)); // leads 1 to 30
  const leadsRun3 = generateLeads(modifiedIndices);
  const run3 = await sendImportRequest(leadsRun3);
  console.log(`Run 3 Duration: ${run3.duration}ms`);
  console.log(`Saved: ${run3.data.savedCount}, Updated: ${run3.data.updatedCount}, Skipped: ${run3.data.skippedCount}`);
  if (run3.data.updatedCount !== 30 || run3.data.skippedCount !== 275) {
    throw new Error(`Run 3 fail: expected 30 updated, 275 skipped, got ${run3.data.updatedCount} updated, ${run3.data.skippedCount} skipped`);
  }

  // Run 4: Re-import exact same list again (should skip all)
  console.log("\n--- RUN 4: Re-importing identical list (should skip all after updates) ---");
  const run4 = await sendImportRequest(leadsRun3);
  console.log(`Run 4 Duration: ${run4.duration}ms`);
  console.log(`Saved: ${run4.data.savedCount}, Updated: ${run4.data.updatedCount}, Skipped: ${run4.data.skippedCount}`);
  if (run4.data.skippedCount !== 305) {
    throw new Error(`Run 4 fail: expected 305 skipped, got ${run4.data.skippedCount}`);
  }

  // Clean up
  await prisma.lead.deleteMany({
    where: { name: { startsWith: "Static Perf Lead" } }
  });
  console.log("\n✅ All runs completed successfully. Optimization behaves correctly!");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Test failed:", err);
  await prisma.lead.deleteMany({
    where: { name: { startsWith: "Static Perf Lead" } }
  });
  await prisma.$disconnect();
  process.exit(1);
});
