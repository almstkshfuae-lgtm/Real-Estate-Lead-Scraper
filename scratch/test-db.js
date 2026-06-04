import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        console.log('Attempting to connect to the database...');
        const users = await prisma.user.findMany();
        console.log(`Connection successful! Found ${users.length} users:`);
        users.forEach(u => console.log(`- ${u.email} (${u.role})`));
    }
    catch (error) {
        console.error('Connection failed:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
