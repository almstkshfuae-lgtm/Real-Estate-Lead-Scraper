import { prisma } from "../lib/prisma";
async function testProjectDatabase() {
    console.log("Testing ProjectHeatmap database operations...\n");
    try {
        const testName = "Test Project " + Date.now();
        // 1. Create a project record
        const newProject = await prisma.projectHeatmap.create({
            data: {
                projectName: testName,
                location: "Dubai Marina",
                developer: "Emaar",
                startingPrice: 1500000,
                handoverDate: "Q4 2026",
                propertyType: "Apartment",
                areaSqft: 1200,
                latitude: 25.0807,
                longitude: 55.1400,
                imageUrl: "http://example.com/image.jpg",
                sourceUrl: "http://example.com"
            }
        });
        console.log("✅ Successfully created project:", newProject.projectName);
        // 2. Read the project record
        const fetched = await prisma.projectHeatmap.findUnique({
            where: { id: newProject.id }
        });
        if (fetched && fetched.projectName === newProject.projectName) {
            console.log("✅ Successfully fetched project from DB.");
        }
        else {
            throw new Error("Failed to fetch project or name mismatch.");
        }
        // 3. Update the project record
        const updated = await prisma.projectHeatmap.update({
            where: { id: newProject.id },
            data: { startingPrice: 1600000 }
        });
        if (updated.startingPrice === 1600000) {
            console.log("✅ Successfully updated project starting price.");
        }
        else {
            throw new Error("Failed to update starting price.");
        }
        // 4. Delete the project record
        await prisma.projectHeatmap.delete({
            where: { id: newProject.id }
        });
        console.log("✅ Successfully deleted project from DB.");
        console.log("\nAll database checks passed successfully!");
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Database test failed:", error);
        process.exit(1);
    }
}
testProjectDatabase();
