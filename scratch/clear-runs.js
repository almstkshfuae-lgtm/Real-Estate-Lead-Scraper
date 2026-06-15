import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.leadScrapeRun.deleteMany({});
  const result = await prisma.scrapeRun.deleteMany({});
  console.log(`Cleared LeadScrapeRun and ScrapeRun tables. Deleted ${result.count} runs.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
