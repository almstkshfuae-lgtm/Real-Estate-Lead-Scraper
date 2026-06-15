import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { prisma } = await import("../lib/prisma");

  const projects = await prisma.projectHeatmap.findMany({
    select: {
      projectName: true,
      latitude: true,
      longitude: true
    }
  });

  console.log("All projects and their coordinates:");
  projects.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.projectName}: lat=${p.latitude}, lng=${p.longitude}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
