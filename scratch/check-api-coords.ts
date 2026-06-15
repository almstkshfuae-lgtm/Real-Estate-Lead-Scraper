import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { NextRequest } from "next/server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const { GET } = await import("../app/api/projects/heatmap/route");

  const req = new NextRequest("http://localhost:3001/api/projects/heatmap");
  const res = await GET(req);
  const data = await res.json();

  console.log(`API returned ${data.projects?.length} projects:`);
  data.projects?.forEach((p: any, idx: number) => {
    console.log(`${idx + 1}. ${p.projectName}: lat=${p.lat}, lng=${p.lng}`);
  });
}

main().catch(console.error);
