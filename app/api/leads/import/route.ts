import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { normalizeLocation, resolveCoords } from "@/lib/ai";

// ─── Field aliases shared with CsvUpload ─────────────────────────────────────
// Maps any raw CSV column name (Arabic or English variant) to a canonical key.
const FIELD_ALIASES: Record<string, string> = {
  // name
  name: "name", Name: "name", "Name (EN)": "name", "Name (AR)": "name",
  "الاسم": "name", "الاسم الكامل": "name", "Full Name": "name",
  "full name": "name", fullname: "name",
  // email
  email: "email", Email: "email", "البريد الإلكتروني": "email",
  "البريد": "email", "E-Mail": "email", "e-mail": "email",
  // phone
  phone: "phone", Phone: "phone", "Phone Number": "phone",
  "رقم الهاتف": "phone", "رقم التليفون": "phone", "الهاتف": "phone",
  Mobile: "phone", mobile: "phone", Tel: "phone", tel: "phone",
  Telephone: "phone",
  // company
  company: "company", Company: "company", "Company (EN)": "company",
  "Company (AR)": "company", "الشركة": "company", "اسم الشركة": "company",
  Organization: "company",
  // role
  role: "role", Role: "role", "Role (EN)": "role", "Role (AR)": "role",
  "المنصب": "role", "الوظيفة": "role", "Job Title": "role",
  Title: "role", Position: "role",
  // location
  location: "location", Location: "location", "الموقع": "location",
  "العنوان": "location", Address: "location", address: "location",
  City: "location", city: "location", Emirate: "location",
  emirate: "location", "المدينة": "location", "الإمارة": "location",
};

/**
 * Normalise a raw row using FIELD_ALIASES.
 * Unknown keys are kept as-is so we don't silently discard any column.
 */
function resolveRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canon = FIELD_ALIASES[key.trim()] ?? key.trim();
    if (!(canon in out)) out[canon] = String(value ?? "").trim();
  }
  return out;
}

/** Clean and normalise a phone string; returns null if clearly empty. */
function cleanPhone(raw: string): string | null {
  if (!raw) return null;
  // Remove spaces, dashes, parentheses but keep leading +
  const cleaned = raw.replace(/[\s\-().]/g, "").replace(/^00/, "+");
  // Must have at least 7 digits to be a valid number
  if (cleaned.replace(/\D/g, "").length < 7) return null;
  return cleaned;
}

/** Clean and basic-validate an email string. */
function cleanEmail(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (!lower.includes("@") || !lower.includes(".")) return null;
  return lower;
}

export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leads: rawLeads } = body;

    if (!rawLeads || !Array.isArray(rawLeads) || rawLeads.length === 0) {
      return NextResponse.json({ error: "No valid leads provided" }, { status: 400 });
    }

    let savedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const skipReasons: string[] = [];

    try {
      // ── Ensure a persistent ScrapeRun for manual imports ─────────────────
      let importRun = await prisma.scrapeRun.findFirst({
        where: { status: "MANUAL_IMPORT" },
      });
      if (!importRun) {
        importRun = await prisma.scrapeRun.create({
          data: {
            triggeredBy: session.id,
            sources: JSON.stringify(["CSV"]),
            criteria: JSON.stringify({ type: "manual_import" }),
            status: "MANUAL_IMPORT",
          },
        });
      }

      for (const rawRow of rawLeads) {
        // ── 1. Normalise column names via alias map ─────────────────────────
        const row = resolveRow(rawRow as Record<string, string>);

        // ── 2. Extract fields ───────────────────────────────────────────────
        const name = (row.name || "").trim() || "Unknown Contact";
        const email = cleanEmail(row.email || "");
        const phone = cleanPhone(row.phone || "");
        const company = (row.company || "").trim() || "Manual Entry";
        const role = (row.role || "").trim() || "Imported Lead";
        const locationRaw = (row.location || "").trim() || "Abu Dhabi";
        const location = normalizeLocation(locationRaw);
        const coords = resolveCoords(location);

        // ── 3. Minimum viability check ──────────────────────────────────────
        // Accept a row if it has ANY of: name (not unknown), email, phone, or company.
        // Only skip truly empty rows (all default fallback values and no contact info).
        const hasIdentity =
          name !== "Unknown Contact" ||
          email !== null ||
          phone !== null ||
          company !== "Manual Entry";

        if (!hasIdentity) {
          skippedCount++;
          skipReasons.push(`Row skipped — no identifiable data: ${JSON.stringify(rawRow)}`);
          continue;
        }

        // ── 4. Deduplication by (name, company) for this agent ─────────────
        // Only deduplicate on unique business identity, not on contact info,
        // since the same phone might appear in two different contacts.
        const existingByUnique = await prisma.lead.findFirst({
          where: {
            name,
            company,
            source: "Manual Import",
            agentId: session.id,
          },
        });

        if (existingByUnique) {
          // Update if we have richer contact info than what's stored
          const shouldUpdate =
            (email && !existingByUnique.email) ||
            (phone && !existingByUnique.phone);

          if (shouldUpdate) {
            await prisma.lead.update({
              where: { id: existingByUnique.id },
              data: {
                email: email || existingByUnique.email,
                phone: phone || existingByUnique.phone,
                role,
                location,
                latitude: coords.lat,
                longitude: coords.lng,
                updatedAt: new Date(),
              },
            });
            updatedCount++;
          } else {
            skippedCount++;
            skipReasons.push(`Duplicate skipped — same name+company already imported: "${name}" @ "${company}"`);
          }
          continue;
        }

        // ── 5. Soft-deduplicate by email only (not phone — phones can be shared) ─
        if (email) {
          const existingByEmail = await prisma.lead.findFirst({
            where: { email, agentId: session.id },
          });
          if (existingByEmail) {
            skippedCount++;
            skipReasons.push(`Duplicate skipped — email already exists: "${email}"`);
            continue;
          }
        }

        // ── 6. Create the lead ──────────────────────────────────────────────
        // Accept leads with ANY meaningful data — even if email AND phone are both null.
        // This ensures contacts with just a name+company+location are not lost.
        await prisma.lead.create({
          data: {
            name,
            company,
            role,
            source: "Manual Import",
            tier: 1,
            email: email || null,
            phone: phone || null,
            location,
            latitude: coords.lat,
            longitude: coords.lng,
            score: 50,
            signals: ["Manual Import"],
            propertyPref: { type: "apartment" },
            status: "new",
            agentId: session.id,
            scrapeRunId: importRun.id,
          },
        });
        savedCount++;
      }

      // ── Notifications ───────────────────────────────────────────────────
      if (savedCount > 0) {
        await notifyNewEliteLeads(session.id, savedCount, importRun.id);
      }
      await notifyScrapeCompletion(session.id, savedCount, importRun.id);

      if (skipReasons.length > 0) {
        console.info(`[CSV Import] Skip reasons (${skipReasons.length}):`, skipReasons.slice(0, 20));
      }

      return NextResponse.json({
        success: true,
        savedCount,
        updatedCount,
        skippedCount,
        totalProcessed: rawLeads.length,
        // Return skip reasons in dev for debugging
        ...(process.env.NODE_ENV !== "production" && skipReasons.length > 0
          ? { skipReasons }
          : {}),
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
    return NextResponse.json(
      {
        error: error.message || "Internal Server Error",
        details:
          process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
