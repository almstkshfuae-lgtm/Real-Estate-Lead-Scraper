import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import prisma from "../lib/prisma";
async function main() {
    console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL);
    console.log("process.env.MYSQL_PUBLIC_URL:", process.env.MYSQL_PUBLIC_URL);
    console.log("\nTesting transaction via proxied client...");
    try {
        const [leads, count] = await prisma.$transaction([
            prisma.$raw.lead.findMany({ take: 1 }),
            prisma.$raw.lead.count()
        ]);
        console.log("Proxied transaction succeeded! Leads count:", count);
    }
    catch (err) {
        console.error("Proxied transaction failed:", err);
    }
    console.log("\nTesting transaction directly on raw client...");
    try {
        const [leads, count] = await prisma.$raw.$transaction([
            prisma.$raw.lead.findMany({ take: 1 }),
            prisma.$raw.lead.count()
        ]);
        console.log("Raw transaction succeeded! Leads count:", count);
    }
    catch (err) {
        console.error("Raw transaction failed:", err);
    }
}
main().catch(console.error);
