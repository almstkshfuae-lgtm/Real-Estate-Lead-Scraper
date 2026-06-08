import prisma from '../lib/prisma';
async function main() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                role: true,
                _count: {
                    select: { leads: true }
                }
            }
        });
        console.log("USERS:");
        for (const u of users) {
            console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.role}, Leads Count: ${u._count.leads}`);
        }
        const leadsCount = await prisma.lead.count();
        console.log(`TOTAL LEADS IN DB: ${leadsCount}`);
        const adminLeadsCount = await prisma.lead.count({
            where: {
                agent: {
                    role: 'admin'
                }
            }
        });
        console.log(`LEADS OWNED BY ADMINS: ${adminLeadsCount}`);
    }
    catch (err) {
        console.error('Error querying:', err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
