import prisma from "../lib/prisma";

async function main() {
  console.log("--- TESTING METRICS QUERIES ---");

  // Mock filters
  const search = "";
  const status = "";
  const tier = "";
  const scrapeRunId = "";

  const conditions: any[] = [];
  conditions.push({ deletedAt: null });

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search } },
        { nameAr: { contains: search } },
        { company: { contains: search } },
        { companyAr: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
        { location: { contains: search } },
      ]
    });
  }

  if (status) {
    conditions.push({ status });
  }

  if (tier) {
    const parsedTier = parseInt(tier);
    if (!isNaN(parsedTier)) {
      conditions.push({ tier: parsedTier });
    }
  }

  if (scrapeRunId) {
    conditions.push({ scrapeRunId });
  }

  const leadWhere: any = conditions.length > 0 ? { AND: conditions } : {};

  // 1. Lead status counts
  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    _count: { id: true },
    where: leadWhere
  });
  console.log("Leads by status:", leadsByStatus);

  // 2. Lead tier counts
  const leadsByTier = await prisma.lead.groupBy({
    by: ["tier"],
    _count: { id: true },
    where: leadWhere
  });
  console.log("Leads by tier:", leadsByTier);

  // 3. Lead source counts excluding "Manual Import"
  const leadWhereExcludingManual = {
    ...leadWhere,
    AND: [
      ...(leadWhere.AND || []),
      { source: { not: "Manual Import" } }
    ]
  };
  const leadsBySource = await prisma.lead.groupBy({
    by: ["source"],
    _count: { id: true },
    where: leadWhereExcludingManual
  });
  console.log("Leads by source (excluding Manual Import):", leadsBySource);

  // 4. Scrape runs active filter
  const scrapeRunWhere = {
    OR: [
      { leadsFound: 0 },
      { leads: { some: { deletedAt: null } } }
    ]
  };

  const runsByStatus = await prisma.scrapeRun.groupBy({
    by: ["status"],
    _count: { id: true },
    where: scrapeRunWhere
  });
  console.log("Runs by status (with active leads filter):", runsByStatus);

  const totalLeads = await prisma.lead.count({ where: leadWhere });
  const totalRuns = await prisma.scrapeRun.count({ where: scrapeRunWhere });

  console.log(`Total Leads: ${totalLeads}`);
  console.log(`Total Runs: ${totalRuns}`);

  console.log("--- TESTING COMPLETED SUCCESSFULLY ---");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
