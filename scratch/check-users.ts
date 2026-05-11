import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
    console.log('USERS:', JSON.stringify(users));
    const scrapeRuns = await prisma.scrapeRun.findMany({ select: { id: true, status: true }, take: 5 });
    console.log('SCRAPE_RUNS:', JSON.stringify(scrapeRuns));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
