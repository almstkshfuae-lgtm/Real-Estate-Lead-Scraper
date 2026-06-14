import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, isAdmin as isAdminRole } from "@/lib/auth";
import { notifyNewEliteLeads, notifyScrapeCompletion } from "@/lib/notifications";
import { normalizeLocation, resolveCoords } from "@/lib/ai";
import { cleanPhone, cleanEmail } from "@/lib/sanitizer";
import { z } from "zod";
import { cleanPersonaPreamble, parseSignals } from "@/lib/signals";
import crypto from "crypto";

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

      // ── In-Memory Validation & Deduplication of Import Batch ───────────────
      const deduplicatedLeads: any[] = [];
      const batchUniqueKeys = new Set<string>();
      const batchEmails = new Set<string>();

      for (const rawRow of rawLeads) {
        const row = resolveRow(rawRow as Record<string, string>);

        // Validate normalized row structure via Zod
        const validation = leadImportSchema.safeParse(row);
        if (!validation.success) {
          skippedCount++;
          skipReasons.push(`Row skipped — invalid data: ${JSON.stringify(validation.error.flatten().fieldErrors)} for row name "${row.name || 'Unknown'}"`);
          continue;
        }

        const name = (row.name || "").trim() || "Unknown Contact";
        const email = cleanEmail(row.email || "");
        const phone = cleanPhone(row.phone || "");
        const company = (row.company || "").trim() || "Manual Entry";
        const role = (row.role || "").trim() || "Imported Lead";
        const locationRaw = (row.location || "").trim() || "Abu Dhabi";
        const location = normalizeLocation(locationRaw);
        const coords = resolveCoords(location);

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

        // Deduplicate name+company within this import batch
        const uniqueKey = `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
        if (batchUniqueKeys.has(uniqueKey)) {
          skippedCount++;
          skipReasons.push(`Duplicate skipped in import batch — same name+company: "${name}" @ "${company}"`);
          continue;
        }

        // Deduplicate email within this import batch
        if (email) {
          const emailLower = email.trim().toLowerCase();
          if (batchEmails.has(emailLower)) {
            skippedCount++;
            skipReasons.push(`Duplicate skipped in import batch — email already exists: "${email}"`);
            continue;
          }
          batchEmails.add(emailLower);
        }

        batchUniqueKeys.add(uniqueKey);

        // Standard keys and extra metadata
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

        deduplicatedLeads.push({
          name,
          email,
          phone,
          company,
          role,
          location,
          coords,
          metadata,
          finalSignals,
          finalPersona,
          row
        });
      }

      // ── Pre-fetch existing leads in bulk to avoid connection-pool-exhausting query storms ──
      const searchNames = Array.from(new Set(deduplicatedLeads.map(item => item.name)));
      const searchEmails = Array.from(new Set(deduplicatedLeads.map(item => item.email).filter((e): e is string => !!e)));

      const existingByName = searchNames.length > 0
        ? await prisma.lead.findMany({
            where: {
              name: { in: searchNames },
              ...(!isAdmin ? { agentId: session.id, source: "Manual Import" } : {})
            }
          })
        : [];

      const uniqueMap = new Map();
      for (const el of existingByName) {
        const key = `${el.name.trim().toLowerCase()}|${el.company.trim().toLowerCase()}`;
        uniqueMap.set(key, el);
      }

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

      // Group leads into creations and updates
      const leadsToCreate: any[] = [];
      const leadsToUpdate: {
        id: string;
        data?: any;
        auditAction?: string;
        auditDetails?: string;
        status: "updated" | "skipped";
        reason?: string;
      }[] = [];
      const leadsToLinkRun: { leadId: string }[] = [];
      const auditLogsToCreate: {
        action: string;
        entityType: string;
        entityId: string;
        agentId: string;
        details: string;
      }[] = [];

      for (const item of deduplicatedLeads) {
        const { name, email, phone, company, role, location, coords, metadata, finalSignals, finalPersona, row } = item;

        // ── Deduplication by (name, company) ─────────────
        const lookupUniqueKey = `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
        const existingByUnique = uniqueMap.get(lookupUniqueKey);

        if (existingByUnique) {
          const shouldUpdate =
            (email && !existingByUnique.email) ||
            (phone && !existingByUnique.phone) ||
            Object.keys(metadata).length > 0 ||
            existingByUnique.deletedAt !== null;

          if (shouldUpdate) {
            const wasDeleted = existingByUnique.deletedAt !== null;
            leadsToUpdate.push({
              id: existingByUnique.id,
              status: "updated",
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
              auditAction: wasDeleted ? "MERGE" : "UPDATE",
              auditDetails: wasDeleted 
                ? `Restored and merged soft-deleted lead via CSV import`
                : `Updated lead details via CSV import`
            });
          } else {
            leadsToUpdate.push({
              id: existingByUnique.id,
              status: "skipped",
              reason: `Duplicate skipped — same name+company already imported: "${name}" @ "${company}"`
            });
          }

          leadsToLinkRun.push({ leadId: existingByUnique.id });
          continue;
        }

        // ── Soft-deduplicate by email only ─
        if (email) {
          const existingByEmail = emailMap.get(email.trim().toLowerCase());
          if (existingByEmail) {
            const wasDeleted = existingByEmail.deletedAt !== null;
            if (wasDeleted) {
              leadsToUpdate.push({
                id: existingByEmail.id,
                status: "updated",
                data: {
                  deletedAt: null,
                  updatedAt: new Date()
                },
                auditAction: "MERGE",
                auditDetails: `Restored soft-deleted lead (matched by email) via CSV import`
              });
            } else {
              leadsToUpdate.push({
                id: existingByEmail.id,
                status: "skipped",
                reason: `Duplicate skipped — email already exists: "${email}"`
              });
            }

            leadsToLinkRun.push({ leadId: existingByEmail.id });
            continue;
          }
        }

        // ── Prepare to create new lead ─
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

        const newLeadId = crypto.randomUUID();

        leadsToCreate.push({
          id: newLeadId,
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
          signals: JSON.stringify(finalSignals),
          persona: finalPersona,
          propertyPref: JSON.stringify({ type: "apartment" }),
          status: "new",
          agentId: session.id,
          metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
        });

        leadsToLinkRun.push({ leadId: newLeadId });
        auditLogsToCreate.push({
          action: "CREATE",
          entityType: "Lead",
          entityId: newLeadId,
          agentId: session.id,
          details: `Created new lead via CSV import`
        });
      }

      // Execute updates (sequentially since they are typically rare and require updates/auditing)
      for (const item of leadsToUpdate) {
        if (item.status === "updated") {
          try {
            await prisma.lead.update({
              where: { id: item.id },
              data: item.data
            });
            updatedCount++;

            if (item.auditAction) {
              await prisma.auditLog.create({
                data: {
                  action: item.auditAction,
                  entityType: "Lead",
                  entityId: item.id,
                  agentId: session.id,
                  details: item.auditDetails
                }
              });
            }
          } catch (updateErr) {
            console.error(`[CSV Import] Failed to update lead ${item.id}:`, updateErr);
          }
        } else if (item.status === "skipped") {
          skippedCount++;
          if (item.reason) skipReasons.push(item.reason);
        }
      }

      // Execute bulk inserts for created leads
      if (leadsToCreate.length > 0) {
        try {
          const createResult = await prisma.lead.createMany({
            data: leadsToCreate,
            skipDuplicates: true
          });
          savedCount += createResult.count;
          
          // Calculate if any were skipped due to P2002 duplicates caught by skipDuplicates
          const skippedCreationsCount = leadsToCreate.length - createResult.count;
          if (skippedCreationsCount > 0) {
            skippedCount += skippedCreationsCount;
            skipReasons.push(`${skippedCreationsCount} new leads skipped due to database duplicate constraint`);
          }
        } catch (createErr) {
          console.error("[CSV Import] Failed during bulk lead creation:", createErr);
          throw createErr;
        }
      }

      // Bulk insert leadScrapeRuns for all leads
      if (leadsToLinkRun.length > 0) {
        const linkData = leadsToLinkRun.map(link => ({
          leadId: link.leadId,
          scrapeRunId: importRun.id
        }));
        try {
          await prisma.leadScrapeRun.createMany({
            data: linkData,
            skipDuplicates: true
          });
        } catch (linkErr) {
          console.error("[CSV Import] Failed during bulk lead-scraperun link creation:", linkErr);
        }
      }

      // Bulk insert audit logs for created leads
      if (auditLogsToCreate.length > 0) {
        try {
          await prisma.auditLog.createMany({
            data: auditLogsToCreate,
            skipDuplicates: true
          });
        } catch (auditErr) {
          console.error("[CSV Import] Failed during bulk audit log creation:", auditErr);
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
