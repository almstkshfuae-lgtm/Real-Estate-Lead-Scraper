import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leads } = body;

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: "No valid leads provided" }, { status: 400 });
    }

    let savedCount = 0;

    // A dummy ScrapeRun for manual imports so it fulfills the foreign key
    // We could find one or create a persistent one for "Manual Imports".
    let importRun = await prisma.scrapeRun.findFirst({
      where: { status: "MANUAL_IMPORT" }
    });

    if (!importRun) {
      importRun = await prisma.scrapeRun.create({
        data: {
          triggeredBy: session.id,
          sources: ["CSV"],
          criteria: { type: "manual_import" },
          status: "MANUAL_IMPORT",
        }
      });
    }

    for (const raw of leads) {
      const email = (raw.email || raw.Email || "").trim();
      const phone = (raw.phone || raw.Phone || "").trim();
      const name = (raw.name || raw.Name || "Unknown Contact").trim();

      // Skip empty
      if (!email && !phone && name === "Unknown Contact") continue;

      const existing = await prisma.lead.findFirst({
        where: {
          OR: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
        },
      });

      if (!existing && (email || phone)) {
        await prisma.lead.create({
          data: {
            name,
            company: (raw.company || raw.Company || "Manual Entry").trim(),
            role: (raw.role || raw.Role || "Imported Lead").trim(),
            source: "Manual Import",
            tier: 1,
            email: email || null,
            phone: phone || null,
            location: (raw.location || raw.Location || "UAE").trim(),
            score: 50,
            signals: ["Manual Import"],
            propertyPref: { type: "apartment" }, // Placeholder
            status: "new",
            agentId: session.id,
            scrapeRunId: importRun.id,
          }
        });
        savedCount++;
      }
    }

    return NextResponse.json({ success: true, savedCount });
  } catch (error: any) {
    console.error("CSV Import Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
