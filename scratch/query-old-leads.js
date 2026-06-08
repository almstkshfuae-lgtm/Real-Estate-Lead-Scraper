import { PrismaClient } from '@prisma/client';
async function main() {
    const prisma = new PrismaClient();
    const leads = await prisma.lead.findMany({
        where: { scrapeRunId: "cmpl7h7hf000d9pdhl1ankfiu" }
    });
    console.log(JSON.stringify(leads, null, 2));
    await prisma.$disconnect();
}
main().catch(console.error);
