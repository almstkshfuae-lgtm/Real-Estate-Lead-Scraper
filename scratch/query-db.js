import prisma from '../lib/prisma.ts';
async function main() {
    const users = await prisma.user.findMany({ take: 10 });
    const leads = await prisma.lead.findMany({ take: 20, orderBy: { createdAt: 'desc' } });
    console.log('USERS:', JSON.stringify(users, null, 2));
    console.log('LEADS:', JSON.stringify(leads, null, 2));
    await prisma.$disconnect();
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
