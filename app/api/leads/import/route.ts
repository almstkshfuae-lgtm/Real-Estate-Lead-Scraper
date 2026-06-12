import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, isAdmin as isAdminRole } from "@/lib/auth";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { normalizeLocation, resolveCoords } from "@/lib/ai";
import { cleanPhone, cleanEmail } from "@/lib/sanitizer";
import { z } from "zod";
import { cleanPersonaPreamble, parseSignals } from "@/lib/signals";

const leadImportSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").nullable().or(z.literal("")).optional(),
  phone: z.string().trim().nullable().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  persona: z.string().trim().optional(),
  signals: z.any().optional(),
});

// ─── Flexible Column name mapping ─────────────────────────────────────────────
// Maps any header variant (Arabic / English / fuzzy matches) to a canonical key.
function getCanonicalHeader(header: string): string | null {
  if (!header) return null;
  const normalized = header.toLowerCase().replace(/[\s\-_]/g, "");

  if (normalized.includes("persona") || normalized.includes("buyerpersona") || normalized.includes("تحليل") || normalized.includes("شخصية")) {
    return "persona";
  }
  if (normalized.includes("signals") || normalized.includes("tags") || normalized.includes("علامات") || normalized.includes("إشارات")) {
    return "signals";
  }

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



export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = isAdminRole(session.role);

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

      // ── Pre-fetch existing leads in bulk to avoid connection-pool-exhausting query storms ──
      const searchPairs: { name: string; company: string }[] = [];
      const searchEmails: string[] = [];

      for (const rawRow of rawLeads) {
        const row = resolveRow(rawRow as Record<string, string>);
        const name = (row.name || "").trim() || "Unknown Contact";
        const company = (row.company || "").trim() || "Manual Entry";
        const email = cleanEmail(row.email || "");

        const hasIdentity = name !== "Unknown Contact" || email !== null || company !== "Manual Entry";
        if (hasIdentity) {
          if (name !== "Unknown Contact" || company !== "Manual Entry") {
            searchPairs.push({ name, company });
          }
          if (email) {
            searchEmails.push(email);
          }
        }
      }

      // Fetch by name + company
      const existingByUniqueList = searchPairs.length > 0
        ? await prisma.lead.findMany({
            where: {
              OR: searchPairs.map(pair => {
                const cond: any = { name: pair.name, company: pair.company };
                if (!isAdmin) {
                  cond.source = "Manual Import";
                  cond.agentId = session.id;
                }
                return cond;
              })
            }
          })
        : [];

      const uniqueMap = new Map();
      for (const el of existingByUniqueList) {
        const key = `${el.name.trim().toLowerCase()}|${el.company.trim().toLowerCase()}`;
        uniqueMap.set(key, el);
      }

      // Fetch by email
      const existingByEmailList = searchEmails.length > 0
        ? await prisma.lead.findMany({
            where: {
              email: { in: searchEmails },
              ...(!isAdmin ? { agentId: session.id } : {})
            }
          })
        : [];

      const emailMap = new Map();
      for (const el of existingByEmailList) {
        if (el.email) {
          emailMap.set(el.email.trim().toLowerCase(), el);
        }
      }

      for (const rawRow of rawLeads) {
        // ── 1. Normalise column names via alias map ─────────────────────────
        const row = resolveRow(rawRow as Record<string, string>);

        // Validate the normalized row properties
        const validation = leadImportSchema.safeParse(row);
        if (!validation.success) {
          skippedCount++;
          skipReasons.push(`Row skipped — invalid data: ${JSON.stringify(validation.error.flatten().fieldErrors)} for row name "${row.name || 'Unknown'}"`);
          continue;
        }

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
        const standardKeys = ["name", "email", "phone", "company", "role", "location", "persona", "signals"];
        const metadata: Record<string, any> = {};
        for (const [key, val] of Object.entries(row)) {
          if (!standardKeys.includes(key)) {
            metadata[key] = val;
          }
        }

        let finalSignals: string[] = [];
        if (row.signals) {
          finalSignals = parseSignals(row.signals);
        }

        let finalPersona: string | null = null;
        if (row.persona) {
          finalPersona = cleanPersonaPreamble(row.persona);
        }

        // ── 3. Minimum viability check ──────────────────────────────────────
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

        // ── 4. Deduplication by (name, company) ─────────────
        const lookupUniqueKey = `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
        const existingByUnique = uniqueMap.get(lookupUniqueKey);

        if (existingByUnique) {
          // Update if we have richer contact info than what's stored or if restoring a soft-deleted lead
          const shouldUpdate =
            (email && !existingByUnique.email) ||
            (phone && !existingByUnique.phone) ||
            Object.keys(metadata).length > 0 ||
            existingByUnique.deletedAt !== null;

          if (shouldUpdate) {
            const wasDeleted = existingByUnique.deletedAt !== null;
            await prisma.lead.update({
              where: { id: existingByUnique.id },
              data: {
                email: email || existingByUnique.email,
                phone: phone || existingByUnique.phone,
                role,
                location,
                latitude: coords.lat,
                longitude: coords.lng,
                ...(finalPersona && { persona: finalPersona }),
                ...(row.signals && { signals: finalSignals }),
                metadata: Object.keys(metadata).length > 0 ? {
                  ...(existingByUnique.metadata as Record<string, any> || {}),
                  ...metadata
                } : (existingByUnique.metadata || undefined),
                updatedAt: new Date(),
                deletedAt: null // Restore if soft deleted
              },
            });
            updatedCount++;

            // Create Audit Log
            try {
              await prisma.auditLog.create({
                data: {
                  action: wasDeleted ? "MERGE" : "UPDATE",
                  entityType: "Lead",
                  entityId: existingByUnique.id,
                  agentId: session.id,
                  details: wasDeleted 
                    ? `Restored and merged soft-deleted lead via CSV import`
                    : `Updated lead details via CSV import`
                }
              });
            } catch (auditErr) {
              console.error("[CSV Import] Failed to create audit log for merge/restore:", auditErr);
            }
          } else {
            skippedCount++;
            skipReasons.push(`Duplicate skipped — same name+company already imported: "${name}" @ "${company}"`);
          }
          continue;
        }

        // ── 5. Soft-deduplicate by email only (not phone — phones can be shared) ─
        if (email) {
          const existingByEmail = emailMap.get(email.trim().toLowerCase());
          if (existingByEmail) {
            if (existingByEmail.deletedAt !== null) {
              // If it's soft-deleted, we can actually restore it and update it
              const wasDeleted = true;
              await prisma.lead.update({
                where: { id: existingByEmail.id },
                data: {
                  deletedAt: null,
                  updatedAt: new Date()
                }
              });
              updatedCount++;
              
              try {
                await prisma.auditLog.create({
                  data: {
                    action: "MERGE",
                    entityType: "Lead",
                    entityId: existingByEmail.id,
                    agentId: session.id,
                    details: `Restored soft-deleted lead (matched by email) via CSV import`
                  }
                });
              } catch (auditErr) {
                console.error("[CSV Import] Failed to create audit log for email restore:", auditErr);
              }
            } else {
              skippedCount++;
              skipReasons.push(`Duplicate skipped — email already exists: "${email}"`);
            }
            continue;
          }
        }

        let computedTier = 3;
        let computedScore = 50;
        const roleLower = role.toLowerCase();
        if (/\b(ceo|founder|co-founder|chairman|president|owner|sheikh|minister|royal)\b/i.test(roleLower)) {
          computedTier = 1;
          computedScore = Math.max(50, Math.floor(Math.random() * 10) + 90);
        } else if (/\b(director|managing director|general manager|head|partner|vp|vice president)\b/i.test(roleLower)) {
          computedTier = 2;
          computedScore = Math.floor(Math.random() * 19) + 70;
        } else if (/\b(manager|specialist|physician|associate|consultant|executive|member)\b/i.test(roleLower)) {
          computedTier = 3;
          computedScore = Math.floor(Math.random() * 19) + 50;
        } else {
          computedTier = 3;
          computedScore = Math.floor(Math.random() * 20) + 30;
        }

        // ── 6. Create the lead ──────────────────────────────────────────────
        try {
          const newLead = await prisma.lead.create({
            data: {
              name,
              company,
              role,
              source: "Manual Import",
              tier: computedTier,
              email: email || null,
              phone: phone || null,
              location,
              latitude: coords.lat,
              longitude: coords.lng,
              score: computedScore,
              signals: finalSignals,
              persona: finalPersona,
              propertyPref: { type: "apartment" },
              status: "new",
              agentId: session.id,
              scrapeRunId: importRun.id,
              metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            },
          });
          savedCount++;

          // Create Audit Log for CREATE
          try {
            await prisma.auditLog.create({
              data: {
                action: "CREATE",
                entityType: "Lead",
                entityId: newLead.id,
                agentId: session.id,
                details: `Created new lead via CSV import`
              }
            });
          } catch (auditErr) {
            console.error("[CSV Import] Failed to create audit log for create:", auditErr);
          }
        } catch (createErr: any) {
          if (createErr.code === 'P2002') {
            console.warn(`[CSV Import] P2002 collision caught on create for "${name}" - attempting updates instead.`);
            // Fetch colliding lead
            const collidingLead = await prisma.lead.findFirst({
              where: {
                name,
                company,
                agentId: session.id
              }
            });

            if (collidingLead) {
              const wasDeleted = collidingLead.deletedAt !== null;
              await prisma.lead.update({
                where: { id: collidingLead.id },
                data: {
                  email: email || collidingLead.email,
                  phone: phone || collidingLead.phone,
                  role,
                  location,
                  latitude: coords.lat,
                  longitude: coords.lng,
                  ...(finalPersona && { persona: finalPersona }),
                  ...(row.signals && { signals: finalSignals }),
                  metadata: Object.keys(metadata).length > 0 ? {
                    ...(collidingLead.metadata as Record<string, any> || {}),
                    ...metadata
                  } : (collidingLead.metadata || undefined),
                  updatedAt: new Date(),
                  deletedAt: null
                }
              });
              updatedCount++;

              try {
                await prisma.auditLog.create({
                  data: {
                    action: wasDeleted ? "MERGE" : "UPDATE",
                    entityType: "Lead",
                    entityId: collidingLead.id,
                    agentId: session.id,
                    details: `Merged colliding lead after P2002 race condition on CSV import`
                  }
                });
              } catch (auditErr) {
                console.error("[CSV Import] Failed to create audit log for collision merge:", auditErr);
              }
            } else {
              skippedCount++;
            }
          } else {
            throw createErr;
          }
        }
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
