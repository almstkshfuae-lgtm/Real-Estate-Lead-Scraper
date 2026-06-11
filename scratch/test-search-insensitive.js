import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        console.log('Testing case insensitive search...');
        const leads = await prisma.lead.findMany({
            where: {
                name: {
                    contains: 'test',
                    mode: 'insensitive'
                }
            },
            take: 1
        });
        console.log('Success! Leads found:', leads.length);
    }
    catch (error) {
        console.error('Failed with error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
