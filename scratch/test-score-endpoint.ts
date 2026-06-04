import { NextRequest } from "next/server";
import { POST } from "../app/api/ai/score/route";
import prisma from "../lib/prisma";

async function main() {
  const lead = await prisma.lead.findFirst();
  if (!lead) {
    console.error("No leads found in database.");
    return;
  }

  console.log(`Found lead: "${lead.name}" (id: ${lead.id})`);

  const req = new NextRequest("http://localhost:3000/api/ai/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadId: lead.id
    })
  });

  console.log("Calling POST /api/ai/score route handler...");
  try {
    const response = await POST(req);
    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Route handler crashed:", err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
