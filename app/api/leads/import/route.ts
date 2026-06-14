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
  email: z.string().trim().optional().nullable(),
  phone: z.string().trim().nullable().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  persona: z.string().trim().optional(),
  signals: z.any().optional(),
  source: z.string().trim().optional(),
  budgetMin: z.any().optional(),
  budgetMax: z.any().optional(),
  tier: z.any().optional(),
  score: z.any().optional(),
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

  // 7. Source check
  if (
    normalized.includes("source") ||
    normalized.includes("المصدر") ||
    normalized.includes("مصدر")
  ) {
    return "source";
  }

  // 8. Budget Min check
  if (
    normalized.includes("budgetmin") ||
    normalized.includes("minbudget") ||
    normalized.includes("minimumbudget") ||
    normalized.includes("الميزانيةالأدنى") ||
    normalized.includes("الحدالأدنىللميزانية") ||
    normalized.includes("budgetfrom") ||
    normalized.includes("min_budget") ||
    normalized.includes("budget_min") ||
    normalized.includes("budget_from") ||
    normalized.includes("minimum_budget")
  ) {
    return "budgetMin";
  }

  // 9. Budget Max check
  if (
    normalized.includes("budgetmax") ||
    normalized.includes("maxbudget") ||
    normalized.includes("maximumbudget") ||
    normalized.includes("الميزانيةالأقصى") ||
    normalized.includes("الحدالأقصىللميزانية") ||
    normalized.includes("budgetto") ||
    normalized.includes("max_budget") ||
    normalized.includes("budget_max") ||
    normalized.includes("budget_to") ||
    normalized.includes("maximum_budget")
  ) {
    return "budgetMax";
  }

  // 10. Tier check
  if (
    normalized.includes("tier") ||
    normalized.includes("مستوى") ||
    normalized.includes("درجة") ||
    normalized.includes("التصنيف") ||
    normalized === "class" ||
    normalized === "grade"
  ) {
    return "tier";
  }

  // 11. Score check
  if (
    normalized.includes("score") ||
    normalized.includes("التقييم") ||
    normalized.includes("درجةالتقييم") ||
    normalized.includes("نقاط") ||
    normalized === "rating" ||
    normalized === "points"
  ) {
    return "score";
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

function parseJsonField(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return parseJsonField(parsed);
    } catch {
      return val;
    }
  }
  if (typeof val === "object") {
    return val;
  }
  return val;
}




function calculateRoleBasedTier(role: string): number {
  const roleLower = role.toLowerCase();
  if (/\b(ceo|founder|co-founder|chairman|president|owner|sheikh|minister|royal)\b/i.test(roleLower)) {
    return 1;
  } else if (/\b(director|managing director|general manager|head|partner|vp|vice president)\b/i.test(roleLower)) {
    return 2;
  }
  return 3;
}

function calculateRoleBasedScore(tier: number): number {
  if (tier === 1) {
    return Math.max(50, Math.floor(Math.random() * 10) + 90);
  } else if (tier === 2) {
    return Math.floor(Math.random() * 19) + 70;
  } else {
    return Math.floor(Math.random() * 19) + 50;
  }
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
        const standardKeys = ["name", "email", "phone", "company", "role", "location", "persona", "signals", "source", "budgetMin", "budgetMax", "tier", "score"];
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

        const source = (row.source || "").trim() || "Manual Import";

        let budgetMin: number | null = null;
        if (row.budgetMin) {
          const parsed = parseFloat(String(row.budgetMin).replace(/[\s,]/g, ""));
          if (!isNaN(parsed)) budgetMin = parsed;
        }

        let budgetMax: number | null = null;
        if (row.budgetMax) {
          const parsed = parseFloat(String(row.budgetMax).replace(/[\s,]/g, ""));
          if (!isNaN(parsed)) budgetMax = parsed;
        }

        let computedTier = 3;
        if (row.tier) {
          const parsed = parseInt(String(row.tier).replace(/\D/g, ""), 10);
          if (!isNaN(parsed) && (parsed === 1 || parsed === 2 || parsed === 3)) {
            computedTier = parsed;
          } else {
            computedTier = calculateRoleBasedTier(role);
          }
        } else {
          computedTier = calculateRoleBasedTier(role);
        }

        let computedScore = 50;
        if (row.score) {
          const parsed = parseInt(String(row.score).replace(/\D/g, ""), 10);
          if (!isNaN(parsed)) {
            computedScore = Math.min(99, Math.max(0, parsed));
          } else {
            computedScore = calculateRoleBasedScore(computedTier);
          }
        } else {
          computedScore = calculateRoleBasedScore(computedTier);
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
          source,
          budgetMin,
          budgetMax,
          computedTier,
          computedScore,
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
        const { name, email, phone, company, role, location, coords, metadata, finalSignals, finalPersona, source, budgetMin, budgetMax, computedTier, computedScore, row } = item;

        // ── Deduplication by (name, company) ─────────────
        const lookupUniqueKey = `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`;
        const existingByUnique = uniqueMap.get(lookupUniqueKey);

        if (existingByUnique) {
          const hasDifferentEmail = email && email !== existingByUnique.email;
          const hasDifferentPhone = phone && phone !== existingByUnique.phone;
          const hasDifferentSource = row.source && source !== existingByUnique.source;
          const hasDifferentTier = row.tier && computedTier !== existingByUnique.tier;
          const hasDifferentScore = row.score && computedScore !== existingByUnique.score;
          const hasDifferentBudgetMin = budgetMin !== null && budgetMin !== existingByUnique.budgetMin;
          const hasDifferentBudgetMax = budgetMax !== null && budgetMax !== existingByUnique.budgetMax;
          const hasDifferentPersona = finalPersona && finalPersona !== existingByUnique.persona;

          const existingSignals = parseSignals(existingByUnique.signals);
          const hasDifferentSignals = row.signals && JSON.stringify(finalSignals.slice().sort()) !== JSON.stringify(existingSignals.slice().sort());

          const existingMetadata = parseJsonField(existingByUnique.metadata) || {};
          const hasDifferentMetadata = Object.keys(metadata).length > 0 && JSON.stringify(metadata) !== JSON.stringify(existingMetadata);

          const shouldUpdate =
            hasDifferentEmail ||
            hasDifferentPhone ||
            hasDifferentSource ||
            hasDifferentTier ||
            hasDifferentScore ||
            hasDifferentBudgetMin ||
            hasDifferentBudgetMax ||
            hasDifferentPersona ||
            hasDifferentSignals ||
            hasDifferentMetadata ||
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
                ...(row.source && { source }),
                ...(row.tier && { tier: computedTier }),
                ...(row.score && { score: computedScore }),
                ...(budgetMin !== null && { budgetMin }),
                ...(budgetMax !== null && { budgetMax }),
                metadata: Object.keys(metadata).length > 0 ? {
                  ...(parseJsonField(existingByUnique.metadata) || {}),
                  ...metadata
                } : (parseJsonField(existingByUnique.metadata) || undefined),
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
        const newLeadId = crypto.randomUUID();

        leadsToCreate.push({
          id: newLeadId,
          name,
          company,
          role,
          source,
          tier: computedTier,
          email: email || null,
          phone: phone || null,
          location,
          latitude: coords.lat,
          longitude: coords.lng,
          score: computedScore,
          signals: finalSignals, // Pass array directly
          persona: finalPersona,
          propertyPref: { type: "apartment" }, // Pass object directly
          status: "new",
          agentId: session.id,
          metadata: Object.keys(metadata).length > 0 ? metadata : null, // Pass object directly
          budgetMin,
          budgetMax,
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

      // Record skipped leads
      for (const item of leadsToUpdate) {
        if (item.status === "skipped") {
          skippedCount++;
          if (item.reason) skipReasons.push(item.reason);
        }
      }

      // Execute updates in parallel batches of size 15 to avoid 504 timeouts and connection pool exhaustion
      const actualUpdates = leadsToUpdate.filter(item => item.status === "updated");
      const BATCH_SIZE = 15;

      for (let i = 0; i < actualUpdates.length; i += BATCH_SIZE) {
        const batch = actualUpdates.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map(async (item) => {
            try {
              await prisma.lead.update({
                where: { id: item.id },
                data: item.data
              });
              updatedCount++;

              if (item.auditAction) {
                auditLogsToCreate.push({
                  action: item.auditAction,
                  entityType: "Lead",
                  entityId: item.id,
                  agentId: session.id,
                  details: item.auditDetails || ""
                });
              }
            } catch (updateErr) {
              console.error(`[CSV Import] Failed to update lead ${item.id}:`, updateErr);
            }
          })
        );
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
