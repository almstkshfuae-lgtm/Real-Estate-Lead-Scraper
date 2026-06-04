import prisma from '../lib/prisma.ts';
async function main() {
    console.log('Querying SourceConfig table...');
    try {
        const sources = await prisma.sourceConfig.findMany();
        console.log(`Found ${sources.length} sources.`);
        sources.forEach(s => {
            console.log(`- [${s.active ? 'ACTIVE' : 'INACTIVE'}] ${s.key}: ${s.name} (${s.url})`);
        });
    }
    catch (err) {
        console.error('Failed to query SourceConfig:', err.message || err);
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
