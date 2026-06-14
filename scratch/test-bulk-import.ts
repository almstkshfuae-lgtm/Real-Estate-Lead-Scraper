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
  console.log("--- Starting Bulk Import Performance Test ---");
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
        email: "test.agent@local",
        passwordHash: "dummyhash",
        name: "Test Agent",
        role: "agent"
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

  // 3. Generate 200 mock leads
  const leads: any[] = [];
  const startTimestamp = Date.now();
  for (let i = 1; i <= 200; i++) {
    const randomSuffix = `${startTimestamp}-${i}`;
    leads.push({
      name: `Performance Lead ${i}`,
      email: `perf.lead.${randomSuffix}@example.com`,
      phone: `+97150${Math.floor(1000000 + Math.random() * 9000000)}`,
      company: `Performance Enterprise ${randomSuffix}`,
      role: i % 10 === 0 ? "CEO" : i % 5 === 0 ? "Director" : "Investor",
      location: i % 2 === 0 ? "Dubai Marina" : "Abu Dhabi",
      signals: ["High Intent", "Cash Buyer", "UAE Resident"],
      persona: "Experienced real estate investor looking for off-plan property."
    });
  }

  console.log(`Generated ${leads.length} mock leads for import.`);

  // 4. Send request
  const PORT = process.env.PORT || 3000;
  const url = `http://localhost:${PORT}/api/leads/import`;
  console.log(`Sending POST request to ${url}...`);

  const startTime = Date.now();
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ leads })
    });

    const duration = Date.now() - startTime;
    console.log(`Response Status: ${response.status}`);
    
    const text = await response.text();
    console.log(`Response Raw Body: ${text.substring(0, 500)}`);
    
    if (response.ok) {
      const data = JSON.parse(text);
      console.log(`\nSuccess!`);
      console.log(`Total Processed: ${data.totalProcessed}`);
      console.log(`Saved: ${data.savedCount}`);
      console.log(`Updated: ${data.updatedCount}`);
      console.log(`Skipped: ${data.skippedCount}`);
      console.log(`Time taken by API request: ${duration}ms`);
      
      if (duration < 1500) {
        console.log("PASS: CSV import completed well under the 10-second threshold!");
      } else {
        console.warn("WARNING: CSV import took longer than 1.5 seconds.");
      }
    } else {
      console.error(`FAIL: API returned error status.`);
    }
  } catch (err) {
    console.error("HTTP Request Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
