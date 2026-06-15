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

  // Zoomed out bounds
  console.log("\n--- Testing Zoomed Out Viewport ---");
  const req1 = new NextRequest("http://localhost:3001/api/projects/heatmap?north=70&south=-40&east=160&west=-50");
  const res1 = await GET(req1);
  const data1 = await res1.json();
  console.log("Projects returned:", data1.projects?.length);

  // Zoomed in bounds around UAE
  console.log("\n--- Testing UAE Viewport ---");
  const req2 = new NextRequest("http://localhost:3001/api/projects/heatmap?north=26.5&south=22.5&east=57.0&west=51.0");
  const res2 = await GET(req2);
  const data2 = await res2.json();
  console.log("Projects returned:", data2.projects?.length);
  if (data2.projects && data2.projects.length > 0) {
    console.log("Sample project inside UAE bounds:", {
      projectName: data2.projects[0].projectName,
      lat: data2.projects[0].lat,
      lng: data2.projects[0].lng,
    });
  }

  // No parameters (All)
  console.log("\n--- Testing No Viewport Params ---");
  const req3 = new NextRequest("http://localhost:3001/api/projects/heatmap");
  const res3 = await GET(req3);
  const data3 = await res3.json();
  console.log("Projects returned:", data3.projects?.length);
}

main().catch(console.error);
