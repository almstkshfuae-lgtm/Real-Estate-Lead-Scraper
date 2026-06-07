import prisma from '../lib/prisma.ts';
async function main() {
    try {
        const source = await prisma.sourceConfig.findUnique({
            where: { key: 'alforsan' }
        });
        console.log(JSON.stringify(source, null, 2));
    } catch (err) {
        console.error(err);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
