import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function runOptimizedTest() {
  console.log("--- Starting Bulk Import Optimized Integration Test ---");
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";

  // 1. Get or create test user
  let user = await prisma.user.findFirst({
    where: { email: "admin@brilliance-lead.uk" }
  });
  if (!user) {
    user = await prisma.user.findFirst();
  }
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: "test-agent-id",
        email: "admin@brilliance-lead.uk",
        passwordHash: "dummyhash",
        name: "Super Admin",
        role: "admin"
      }
    });
  }

  console.log(`Using user: ${user.name} (${user.email}) - Role: ${user.role}`);

  // 2. Generate token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  // 3. Clean up old test leads
  await prisma.lead.deleteMany({
    where: { name: { startsWith: "Direct Lead" } }
  });

  const mockLeads = [
    {
      name: "Direct Lead 1",
      email: "invalid-email-no-at-sign", // invalid email format, should NOT skip the row
      phone: "+971501111111",
      company: "Direct Company 1",
      role: "CEO",
      location: "Dubai Marina",
      source: "Elite CSV Source",
      budgetMin: "1,500,000", // with comma
      budgetMax: "3 000 000", // with space
      tier: "1",
      score: "98"
    },
    {
      name: "Direct Lead 2",
      email: "valid.email@gmail.com",
      phone: "+971502222222",
      company: "Direct Company 2",
      role: "Sales Executive",
      location: "Abu Dhabi",
      source: "Dubizzle Export",
      budgetMin: "750000",
      budgetMax: "1250000",
      tier: "3",
      score: "55"
    },
    {
      name: "Direct Lead 3",
      email: "N/A", // placeholder email, should NOT skip the row
      phone: "+971503333333",
      company: "Direct Company 3",
      role: "Managing Director",
      location: "الشارقة",
      source: "", // empty source, should default to "Manual Import"
      budgetMin: "",
      budgetMax: "",
      tier: "", // empty tier, should compute based on role MD -> Tier 2
      score: "" // empty score, should compute based on tier
    }
  ];

  console.log("Mock leads defined. Sending POST request to local dev server...");

  const url = `http://localhost:3001/api/leads/import`;
  const startTime = Date.now();
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ leads: mockLeads })
    });

    const duration = Date.now() - startTime;
    console.log(`Response Status: ${response.status}`);
    const text = await response.text();
    console.log(`Response Body: ${text}`);

    if (response.ok) {
      console.log("✅ API call succeeded!");
      const data = JSON.parse(text);

      // Verify the leads were created correctly in DB
      const createdLeads = await prisma.lead.findMany({
        where: { name: { startsWith: "Direct Lead" } },
        orderBy: { name: "asc" }
      });

      console.log(`Found ${createdLeads.length} created leads in database.`);
      if (createdLeads.length === 3) {
        console.log("✅ All 3 leads were imported successfully (none were skipped due to invalid email format)!");
      } else {
        console.error("❌ Mismatch in lead count!");
      }

      // Check Lead 1
      const l1 = createdLeads[0];
      console.log("\nLead 1 Details:");
      console.log(`- Email (expected null): ${l1.email}`);
      console.log(`- Source (expected "Elite CSV Source"): ${l1.source}`);
      console.log(`- BudgetMin (expected 1500000): ${l1.budgetMin}`);
      console.log(`- BudgetMax (expected 3000000): ${l1.budgetMax}`);
      console.log(`- Tier (expected 1): ${l1.tier}`);
      console.log(`- Score (expected 98): ${l1.score}`);

      if (l1.email === null && l1.source === "Elite CSV Source" && l1.budgetMin === 1500000 && l1.budgetMax === 3000000 && l1.tier === 1 && l1.score === 98) {
        console.log("✅ Lead 1 parsed and stored correctly!");
      } else {
        console.error("❌ Lead 1 parsing mismatch!");
      }

      // Check Lead 2
      const l2 = createdLeads[1];
      console.log("\nLead 2 Details:");
      console.log(`- Email (expected "valid.email@gmail.com"): ${l2.email}`);
      console.log(`- Source (expected "Dubizzle Export"): ${l2.source}`);
      console.log(`- BudgetMin (expected 750000): ${l2.budgetMin}`);
      console.log(`- BudgetMax (expected 1250000): ${l2.budgetMax}`);
      console.log(`- Tier (expected 3): ${l2.tier}`);
      console.log(`- Score (expected 55): ${l2.score}`);

      if (l2.email === "valid.email@gmail.com" && l2.source === "Dubizzle Export" && l2.budgetMin === 750000 && l2.budgetMax === 1250000 && l2.tier === 3 && l2.score === 55) {
        console.log("✅ Lead 2 parsed and stored correctly!");
      } else {
        console.error("❌ Lead 2 parsing mismatch!");
      }

      // Check Lead 3
      const l3 = createdLeads[2];
      console.log("\nLead 3 Details:");
      console.log(`- Email (expected null): ${l3.email}`);
      console.log(`- Source (expected "Manual Import"): ${l3.source}`);
      console.log(`- BudgetMin (expected null): ${l3.budgetMin}`);
      console.log(`- BudgetMax (expected null): ${l3.budgetMax}`);
      console.log(`- Tier (expected 2): ${l3.tier}`);
      console.log(`- Score (expected 70-88): ${l3.score}`);

      if (l3.email === null && l3.source === "Manual Import" && l3.budgetMin === null && l3.budgetMax === null && l3.tier === 2 && l3.score >= 70 && l3.score <= 88) {
        console.log("✅ Lead 3 parsed and stored correctly!");
      } else {
        console.error("❌ Lead 3 parsing mismatch!");
      }

      // Test re-import
      console.log("\n--- Testing Re-import (shouldUpdate Optimization) ---");
      const reStart = Date.now();
      const res2 = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ leads: mockLeads })
      });
      const reDuration = Date.now() - reStart;
      const text2 = await res2.text();
      console.log("Re-import Response:", text2);
      console.log(`Re-import duration: ${reDuration}ms`);

      const data2 = JSON.parse(text2);
      if (data2.success && data2.savedCount === 0 && data2.updatedCount === 0 && data2.skippedCount === 3) {
        console.log("✅ shouldUpdate Optimization works! 0 saved, 0 updated, 3 skipped (all duplicate and identical).");
      } else {
        console.error("❌ shouldUpdate Optimization failed!");
      }

    } else {
      console.error("❌ HTTP request failed!");
    }
  } catch (err: any) {
    console.error("❌ Network or runtime error:", err.message || err);
  } finally {
    // Clean up
    await prisma.lead.deleteMany({
      where: { name: { startsWith: "Direct Lead" } }
    });
    await prisma.$disconnect();
  }
}

// Wait a bit for server to spin up, then run
setTimeout(runOptimizedTest, 3000);
