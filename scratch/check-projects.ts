import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { prisma } = await import("../lib/prisma");

  console.log("Analyzing project heatmaps in the database...");
  const total = await prisma.projectHeatmap.count();
  const withCoords = await prisma.projectHeatmap.count({
    where: {
      latitude: { not: null },
      longitude: { not: null }
    }
  });

  const sample = await prisma.projectHeatmap.findMany({
    take: 10,
    select: {
      id: true,
      projectName: true,
      location: true,
      latitude: true,
      longitude: true
    }
  });

  console.log("Total projects:", total);
  console.log("Projects with coordinates:", withCoords);
  console.log("Projects without coordinates:", total - withCoords);
  console.log("Sample projects:", JSON.stringify(sample, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
