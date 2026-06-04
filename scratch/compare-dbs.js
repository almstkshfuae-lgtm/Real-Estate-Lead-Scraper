import { PrismaClient } from "@prisma/client";
async function testUrl(url, name) {
    console.log(`Connecting to ${name}...`);
    const prisma = new PrismaClient({
        datasources: { db: { url } }
    });
    try {
        const count = await prisma.lead.count();
        console.log(`${name} lead count: ${count}`);
        const first = await prisma.lead.findFirst({ select: { name: true } });
        console.log(`${name} first lead name:`, first === null || first === void 0 ? void 0 : first.name);
    }
    catch (err) {
        console.error(`${name} failed:`, err.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
async function main() {
    const zephyr = "mysql://root:iWLYuontaDcIoOQvhLyHJFpyFPIuuUuu@zephyr.proxy.rlwy.net:40660/railway";
    const viaduct = "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway";
    await testUrl(zephyr, "Zephyr");
    await testUrl(viaduct, "Viaduct");
}
main().catch(console.error);
