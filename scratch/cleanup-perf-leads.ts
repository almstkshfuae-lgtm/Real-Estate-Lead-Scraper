import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up mock performance leads from database...");
  const deleteLeads = await prisma.lead.deleteMany({
    where: {
      name: {
        startsWith: "Performance Lead"
      }
    }
  });
  console.log(`Deleted ${deleteLeads.count} mock leads.`);

  // Also clean up manual import scrape runs that we created
  const deleteRuns = await prisma.scrapeRun.deleteMany({
    where: {
      status: "MANUAL_IMPORT",
      leadsFound: 200
    }
  });
  console.log(`Deleted ${deleteRuns.count} MANUAL_IMPORT scrape runs.`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
