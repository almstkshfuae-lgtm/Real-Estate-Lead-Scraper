import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const counts = await prisma.lead.groupBy({
            by: ['status'],
            _count: {
                _all: true
            }
        });
        console.log('Lead counts by status:', JSON.stringify(counts, null, 2));
    }
    catch (e) {
        console.error(e);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
