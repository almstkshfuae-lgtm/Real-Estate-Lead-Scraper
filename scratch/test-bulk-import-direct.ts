// Mock next/headers and lib/auth before any imports are resolved
import Module from "module";

const originalRequire = (Module.prototype as any).require;
(Module.prototype as any).require = function (id: string) {
  if (id === "next/headers") {
    return {
      cookies: async () => ({
        get: () => ({ value: "mock_token" })
      }),
      headers: async () => ({
        get: () => "Bearer mock_token"
      })
    };
  }
  if (id.endsWith("lib/auth") || id.includes("lib/auth") || id.endsWith("@/lib/auth")) {
    return {
      getSessionWithDBVerify: async () => {
        // We will return a real admin user or fallback
        return { id: "test-agent-id", email: "admin@brilliance-lead.uk", role: "admin" };
      },
      isAdmin: () => true,
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now import the rest of the dependencies
import { PrismaClient } from "@prisma/client";
import { POST } from "../app/api/leads/import/route";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const prisma = new PrismaClient();

async function runDirectTest() {
  console.log("--- Starting Bulk Import Direct Integration Test ---");
  
  // Clean up any old test leads
  await prisma.lead.deleteMany({
    where: { name: { startsWith: "Direct Lead" } }
  });

  // Ensure test agent user exists in the database
  let user = await prisma.user.findFirst({
    where: { email: "admin@brilliance-lead.uk" }
  });
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
      email: "valid.email@example.com",
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

  console.log("Mock leads defined. Sending direct POST payload...");

  try {
    const req = new Request("http://localhost/api/leads/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ leads: mockLeads })
    });

    const res = await POST(req);
    const body = await res.json();
    console.log("Response Body:", body);

    if (body.success) {
      console.log("✅ API call succeeded!");
      
      // Query the database to verify the leads were created correctly
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

      // Check Lead 1: source, budgetMin, budgetMax, tier, score, email
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

      // Check Lead 2: source, budgetMin, budgetMax, tier, score, email
      const l2 = createdLeads[1];
      console.log("\nLead 2 Details:");
      console.log(`- Email (expected "valid.email@example.com"): ${l2.email}`);
      console.log(`- Source (expected "Dubizzle Export"): ${l2.source}`);
      console.log(`- BudgetMin (expected 750000): ${l2.budgetMin}`);
      console.log(`- BudgetMax (expected 1250000): ${l2.budgetMax}`);
      console.log(`- Tier (expected 3): ${l2.tier}`);
      console.log(`- Score (expected 55): ${l2.score}`);

      if (l2.email === "valid.email@example.com" && l2.source === "Dubizzle Export" && l2.budgetMin === 750000 && l2.budgetMax === 1250000 && l2.tier === 3 && l2.score === 55) {
        console.log("✅ Lead 2 parsed and stored correctly!");
      } else {
        console.error("❌ Lead 2 parsing mismatch!");
      }

      // Check Lead 3: source, budgetMin, budgetMax, tier, score, email
      const l3 = createdLeads[2];
      console.log("\nLead 3 Details:");
      console.log(`- Email (expected null): ${l3.email}`);
      console.log(`- Source (expected "Manual Import"): ${l3.source}`);
      console.log(`- BudgetMin (expected null): ${l3.budgetMin}`);
      console.log(`- BudgetMax (expected null): ${l3.budgetMax}`);
      console.log(`- Tier (expected 2 - Managing Director): ${l3.tier}`);
      console.log(`- Score (expected 70-88): ${l3.score}`);

      if (l3.email === null && l3.source === "Manual Import" && l3.budgetMin === null && l3.budgetMax === null && l3.tier === 2 && l3.score >= 70 && l3.score <= 88) {
        console.log("✅ Lead 3 parsed and stored correctly!");
      } else {
        console.error("❌ Lead 3 parsing mismatch!");
      }

      // Test re-import to check shouldUpdate optimization
      console.log("\n--- Testing Re-import (shouldUpdate Optimization) ---");
      const startTime = Date.now();
      const res2 = await POST(new Request("http://localhost/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: mockLeads })
      }));
      const body2 = await res2.json();
      const duration = Date.now() - startTime;
      
      console.log("Re-import Response Body:", body2);
      console.log(`Re-import duration: ${duration}ms`);
      
      // Since they are identical and duplicate, they should be skipped.
      if (body2.success && body2.savedCount === 0 && body2.updatedCount === 0 && body2.skippedCount === 3) {
        console.log("✅ shouldUpdate Optimization works! 0 saved, 0 updated, 3 skipped (all duplicate and identical).");
      } else {
        console.error("❌ shouldUpdate Optimization failed!");
      }

    } else {
      console.error("❌ API call returned error:", body);
    }
  } catch (err: any) {
    console.error("❌ Error running integration test:", err.message || err);
  } finally {
    // Clean up
    await prisma.lead.deleteMany({
      where: { name: { startsWith: "Direct Lead" } }
    });
    await prisma.$disconnect();
  }
}

runDirectTest();
