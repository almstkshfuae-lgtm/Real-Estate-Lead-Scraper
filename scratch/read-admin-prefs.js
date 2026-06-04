import prisma from "../lib/prisma";
async function main() {
    const admin = await prisma.user.findFirst({
        where: { role: "admin" }
    });
    if (admin) {
        console.log("Admin email:", admin.email);
        console.log("Preferences:", admin.preferences);
    }
    else {
        console.log("No admin user found!");
    }
}
main().catch(console.error);
