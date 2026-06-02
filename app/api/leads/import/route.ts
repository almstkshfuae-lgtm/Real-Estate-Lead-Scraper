import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { normalizeLocation, resolveCoords } from "@/lib/ai";

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
    let skippedCount = 0;
    let updatedCount = 0;

    // A dummy ScrapeRun for manual imports so it fulfills the foreign key
    // We could find one or create a persistent one for "Manual Imports".
    try {
      let importRun = await prisma.scrapeRun.findFirst({
        where: { status: "MANUAL_IMPORT" }
      });

      if (!importRun) {
        importRun = await prisma.scrapeRun.create({
          data: {
            triggeredBy: session.id,
            sources: JSON.stringify(["CSV"]),
            criteria: JSON.stringify({ type: "manual_import" }),
            status: "MANUAL_IMPORT",
          }
        });
      }

      for (const raw of leads) {
        // Handle both raw field names and exported headers
        const email = (raw.email || raw.Email || raw["Email"] || "").trim();
        const phone = (raw.phone || raw.Phone || raw["Phone"] || "").trim();
        const name = (raw.name || raw.Name || raw["Name (EN)"] || raw["Name (AR)"] || "Unknown Contact").trim();
        const company = (raw.company || raw.Company || raw["Company (EN)"] || raw["Company (AR)"] || "Manual Entry").trim();
        const role = (raw.role || raw.Role || raw["Role (EN)"] || raw["Role (AR)"] || "Imported Lead").trim();
        const locationRaw = (raw.location || raw.Location || raw["Location"] || "Abu Dhabi").trim();
        const location = normalizeLocation(locationRaw);
        const coords = resolveCoords(location);

        // Skip empty
        if (!email && !phone && name === "Unknown Contact") {
          skippedCount++;
          continue;
        }

        // Check for unique constraint (name, company, source)
        const existingByUnique = await prisma.lead.findFirst({
          where: {
            name,
            company,
            source: "Manual Import",
          },
        });

        if (existingByUnique) {
          // Update existing lead
          await prisma.lead.update({
            where: { id: existingByUnique.id },
            data: {
              email: email || existingByUnique.email,
              phone: phone || existingByUnique.phone,
              role,
              location, // normalized location
              latitude: coords.lat,
              longitude: coords.lng,
              updatedAt: new Date(),
            }
          });
          updatedCount++;
          continue;
        }

        // Check for duplicate by email or phone (optional warning)
        const existingByContactInfo = await prisma.lead.findFirst({
          where: {
            OR: [
              ...(email ? [{ email }] : []),
              ...(phone ? [{ phone }] : []),
            ],
          },
        });

        if (existingByContactInfo) {
          // Skip if found by contact info but different name/company
          skippedCount++;
          continue;
        }

        // Create new lead
        if (email || phone) {
          await prisma.lead.create({
            data: {
              name,
              company,
              role,
              source: "Manual Import",
              tier: 1,
              email: email || null,
              phone: phone || null,
              location, // normalized location
              latitude: coords.lat,
              longitude: coords.lng,
              score: 50,
              signals: JSON.stringify(["Manual Import"]),
              propertyPref: JSON.stringify({ type: "apartment" }),
              status: "new",
              agentId: session.id,
              scrapeRunId: importRun.id,
            }
          });
          savedCount++;
        } else {
          skippedCount++;
        }
      }

      if (savedCount > 0) {
        await notifyNewEliteLeads(session.id, savedCount, importRun.id);
      }

      await notifyScrapeCompletion(session.id, savedCount, importRun.id);

      return NextResponse.json({
        success: true,
        savedCount,
        updatedCount,
        skippedCount,
        totalProcessed: leads.length
      });
    } catch (dbError: any) {
      console.error("Database Error:", dbError);
      console.error("Error message:", dbError.message);
      console.error("Error code:", dbError.code);
      throw dbError;
    }
  } catch (error: any) {
    console.error("CSV Import Error:", error);
    console.error("Error details:", error.message || error);
    console.error("Stack trace:", error.stack);
    return NextResponse.json({
      error: error.message || "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
