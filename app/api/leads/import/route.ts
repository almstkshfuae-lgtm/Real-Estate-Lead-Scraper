import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { normalizeLocation, resolveCoords } from "@/lib/ai";

// ─── Flexible Column name mapping ─────────────────────────────────────────────
// Maps any header variant (Arabic / English / fuzzy matches) to a canonical key.
function getCanonicalHeader(header: string): string | null {
  if (!header) return null;
  const normalized = header.toLowerCase().replace(/[\s\-_]/g, "");

  // 0. Social media / link check (to prevent matching standard columns and ensure routing to metadata)
  const lowerHeader = header.toLowerCase().trim();
  if (
    lowerHeader.includes("http://") ||
    lowerHeader.includes("https://") ||
    lowerHeader.startsWith("www.") ||
    /\.(com|ae|org|net|co|io|me|gov|edu|info|us|ar|en)(\/|$)/i.test(lowerHeader) ||
    normalized.includes("linkedin") ||
    normalized.includes("facebook") ||
    normalized.includes("twitter") ||
    normalized.includes("instagram") ||
    normalized.includes("snapchat") ||
    normalized.includes("tiktok") ||
    normalized.includes("social") ||
    normalized === "link" ||
    normalized === "url" ||
    normalized.includes("website") ||
    normalized.includes("web") ||
    normalized.includes("profile") ||
    normalized.includes("page") ||
    normalized.includes("youtube") ||
    normalized.includes("github") ||
    normalized.includes("telegram") ||
    normalized.includes("t.me") ||
    normalized.includes("wa.me")
  ) {
    return null;
  }

  // 1. Email check (very specific)
  if (
    normalized.includes("email") ||
    normalized.includes("mail") ||
    normalized.includes("البريد") ||
    normalized.includes("بريد")
  ) {
    return "email";
  }

  // 2. Company check
  if (
    normalized.includes("company") ||
    normalized.includes("org") ||
    normalized.includes("firm") ||
    normalized.includes("employer") ||
    normalized.includes("شركة") ||
    normalized.includes("الشركة")
  ) {
    return "company";
  }

  // 3. Role check
  if (
    normalized.includes("role") ||
    normalized.includes("title") ||
    normalized.includes("job") ||
    normalized.includes("position") ||
    normalized.includes("designation") ||
    normalized.includes("منصب") ||
    normalized.includes("وظيفة")
  ) {
    return "role";
  }

  // 4. Location check
  if (
    normalized.includes("location") ||
    normalized.includes("address") ||
    normalized.includes("city") ||
    normalized.includes("emirate") ||
    normalized.includes("region") ||
    normalized.includes("state") ||
    normalized.includes("area") ||
    normalized.includes("عنوان") ||
    normalized.includes("موقع") ||
    normalized.includes("إمارة") ||
    normalized.includes("مدينة")
  ) {
    return "location";
  }

  // 5. Name check (placed before generic contact/phone check so "Contact Name" becomes "name")
  if (
    normalized.includes("name") ||
    normalized.includes("nom") ||
    normalized.includes("الاسم") ||
    normalized.includes("اسم") ||
    normalized.includes("client") ||
    normalized.includes("customer") ||
    normalized.includes("lead") ||
    normalized.includes("buyer") ||
    normalized.includes("person") ||
    normalized.includes("user")
  ) {
    return "name";
  }

  // 6. Phone / Contact check (more specific to avoid matching general contact links/social URLs)
  if (
    normalized.includes("phone") ||
    normalized.includes("mobile") ||
    normalized.includes("cell") ||
    normalized.includes("tel") ||
    normalized.includes("هاتف") ||
    normalized.includes("تليفون") ||
    normalized.includes("جوال") ||
    normalized === "ph" ||
    normalized === "contact" ||
    normalized.includes("contactnumber") ||
    normalized.includes("contactphone") ||
    normalized.includes("contactno")
  ) {
    return "phone";
  }

  return null;
}

/**
 * Normalise a raw row using fuzzy header matching.
 * Combines first and last name columns if present.
 * Unknown keys are kept as-is so we don't silently discard any column.
 */
function resolveRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};

  // Combine separate First Name and Last Name columns if they exist
  let firstName = "";
  let lastName = "";

  for (const [key, value] of Object.entries(raw)) {
    const normKey = key.toLowerCase().replace(/[\s\-_]/g, "");
    const valStr = String(value ?? "").trim();

    if (normKey.includes("firstname") || normKey === "fname" || normKey === "first") {
      firstName = valStr;
      continue;
    }
    if (normKey.includes("lastname") || normKey === "lname" || normKey === "last") {
      lastName = valStr;
      continue;
    }
  }

  if (firstName || lastName) {
    out["name"] = `${firstName} ${lastName}`.trim();
  }

  for (const [key, value] of Object.entries(raw)) {
    const normKey = key.toLowerCase().replace(/[\s\-_]/g, "");

    // Skip keys already consumed as part of first/last name
    if (
      normKey.includes("firstname") || normKey === "fname" || normKey === "first" ||
      normKey.includes("lastname") || normKey === "lname" || normKey === "last"
    ) {
      continue;
    }

    const canonical = getCanonicalHeader(key);
    if (canonical) {
      // Don't overwrite dynamic name concatenation if name is already populated
      if (canonical === "name" && out["name"]) {
        continue;
      }
      out[canonical] = String(value ?? "").trim();
    } else {
      out[key.trim()] = String(value ?? "").trim();
    }
  }
  return out;
}

/** Clean and normalise a phone string; returns null if clearly empty. */
export function cleanPhone(raw: string): string | null {
  if (!raw) return null;
  
  // Remove spaces, dashes, parentheses, dots
  let cleaned = raw.replace(/[\s\-().]/g, "");
  
  // Replace leading 00 with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.substring(2);
  }
  
  // If it doesn't start with +, add standard country code normalization
  if (!cleaned.startsWith("+")) {
    // If it starts with a leading 0 followed by 5 (e.g., 050, 052) and length is 10:
    if (cleaned.startsWith("05") && cleaned.length === 10) {
      cleaned = "+971" + cleaned.substring(1);
    }
    // If it starts with 5 and has length of 9 (e.g., 507778888):
    else if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "+971" + cleaned;
    }
    // If it is already in international format but missing + (e.g., 971..., 966..., 1...):
    else if (cleaned.length >= 7) {
      cleaned = "+" + cleaned;
    }
  }

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

        // Extract extra/metadata fields
        const standardKeys = ["name", "email", "phone", "company", "role", "location"];
        const metadata: Record<string, any> = {};
        for (const [key, val] of Object.entries(row)) {
          if (!standardKeys.includes(key)) {
            metadata[key] = val;
          }
        }

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
            (phone && !existingByUnique.phone) ||
            Object.keys(metadata).length > 0;

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
                metadata: Object.keys(metadata).length > 0 ? {
                  ...(existingByUnique.metadata as Record<string, any> || {}),
                  ...metadata
                } : (existingByUnique.metadata || undefined),
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
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
