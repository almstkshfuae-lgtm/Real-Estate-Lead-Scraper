import { PrismaClient } from '@prisma/client';
async function main() {
    const prisma = new PrismaClient();
    const admin = await prisma.user.findFirst({
        where: { role: 'admin' }
    });
    if (admin) {
        console.log('Admin Email:', admin.email);
        console.log('Admin Preferences:', admin.preferences);
    }
    else {
        console.log('No admin found.');
    }
    await prisma.$disconnect();
}
main().catch(console.error);
