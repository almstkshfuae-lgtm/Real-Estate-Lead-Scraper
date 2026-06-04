import prisma from "../lib/prisma";
async function main() {
    console.log("Fetching a lead...");
    try {
        const lead = await prisma.lead.findFirst();
        console.log("Lead successfully fetched:", lead);
    }
    catch (err) {
        console.error("DB Query failed:", err);
    }
}
main().catch(console.error);
