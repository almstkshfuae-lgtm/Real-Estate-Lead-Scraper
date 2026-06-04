import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    const runs = await prisma.scrapeRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5
    });
    console.log('Recent Scrape Runs:', JSON.stringify(runs, null, 2));
}
main().finally(() => prisma.$disconnect());
