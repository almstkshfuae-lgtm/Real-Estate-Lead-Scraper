import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import prisma from "../lib/prisma";
async function main() {
    console.log("process.env.DATABASE_URL:", process.env.DATABASE_URL);
    console.log("process.env.MYSQL_PUBLIC_URL:", process.env.MYSQL_PUBLIC_URL);
    try {
        const count = await prisma.lead.count();
        console.log("Lead count from prisma:", count);
        const leads = await prisma.lead.findMany({ take: 5, select: { name: true, location: true } });
        console.log("Leads sample:", leads);
    }
    catch (err) {
        console.error("Prisma query failed:", err.message);
    }
}
main().catch(console.error);
