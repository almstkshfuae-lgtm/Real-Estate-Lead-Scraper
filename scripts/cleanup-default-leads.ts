import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting lead cleanup script...");

  // Find all leads that contain default fallbacks
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { company: "Manual Entry" },
        { company: "Not Specified" },
        { role: "Imported Lead" },
        { role: "Professional" },
      ],
    },
  });

  console.log(`Found ${leads.length} leads with default fallbacks.`);

  let updatedCount = 0;
  let mergedCount = 0;
  let errorCount = 0;

  for (const lead of leads) {
    const targetCompany =
      lead.company === "Manual Entry" || lead.company === "Not Specified"
        ? ""
        : lead.company;
    const targetRole =
      lead.role === "Imported Lead" || lead.role === "Professional"
        ? ""
        : lead.role;

    // Skip if there are no changes to apply (should not happen based on query)
    if (targetCompany === lead.company && targetRole === lead.role) {
      continue;
    }

    try {
      // Attempt to update the lead with empty strings
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          company: targetCompany,
          role: targetRole,
        },
      });
      updatedCount++;
    } catch (err: any) {
      // Check for Prisma unique constraint violation (P2002)
      if (err.code === "P2002" || err.message?.includes("Lead_name_company_source_agentId_key")) {
        console.info(
          `Unique constraint collision for lead "${lead.name}" (id: ${lead.id}). Attempting merge...`
        );

        try {
          // Find the existing lead that conflicts with our target update
          const existingLead = await prisma.lead.findFirst({
            where: {
              name: lead.name,
              company: targetCompany,
              source: lead.source,
              agentId: lead.agentId,
              deletedAt: null,
            },
          });

          if (existingLead) {
            // Merge emails, phones, signals
            const mergedEmail = existingLead.email || lead.email;
            const mergedPhone = existingLead.phone || lead.phone;

            // Merge signals arrays safely
            const parseSignals = (sigField: any): string[] => {
              if (!sigField) return [];
              if (Array.isArray(sigField)) return sigField;
              if (typeof sigField === "string") {
                try {
                  return JSON.parse(sigField);
                } catch {
                  return sigField.split(",").map((s) => s.trim());
                }
              }
              return [];
            };

            const existingSignals = parseSignals(existingLead.signals);
            const leadSignals = parseSignals(lead.signals);
            const mergedSignals = Array.from(
              new Set([...existingSignals, ...leadSignals])
            );

            // Update existing lead with merged details
            await prisma.lead.update({
              where: { id: existingLead.id },
              data: {
                email: mergedEmail,
                phone: mergedPhone,
                signals: mergedSignals,
              },
            });

            // Re-link related LeadScrapeRuns to the existing lead
            await prisma.leadScrapeRun.updateMany({
              where: { leadId: lead.id },
              data: { leadId: existingLead.id },
            });

            // Delete the duplicate lead
            await prisma.lead.delete({
              where: { id: lead.id },
            });

            // Create Audit Log
            await prisma.auditLog.create({
              data: {
                action: "MERGE",
                entityType: "Lead",
                entityId: existingLead.id,
                details: `Merged duplicate lead "${lead.name}" (id: ${lead.id}) into (id: ${existingLead.id}) during default fallbacks cleanup.`,
              },
            });

            mergedCount++;
          } else {
            console.error(
              `Collision detected but conflicting lead not found for "${lead.name}".`
            );
            errorCount++;
          }
        } catch (mergeErr) {
          console.error(`Failed to merge lead "${lead.name}":`, mergeErr);
          errorCount++;
        }
      } else {
        console.error(`Failed to update lead "${lead.name}":`, err);
        errorCount++;
      }
    }
  }

  console.log("Cleanup completed!");
  console.log(`Updated successfully: ${updatedCount}`);
  console.log(`Merged & deleted duplicates: ${mergedCount}`);
  console.log(`Errors encountered: ${errorCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
