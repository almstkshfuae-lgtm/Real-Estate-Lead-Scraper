import prisma from "../lib/prisma";

async function main() {
  console.log("=== STARTING DYNAMIC SCRAPE-RUN COUNTS TEST ===");

  // Find a run with leads
  const runWithLeads = await prisma.scrapeRun.findFirst({
    where: {
      leads: { some: {} }
    },
    include: {
      leads: true
    }
  });

  if (!runWithLeads) {
    console.log("No runs with leads found in the database. Seeding/skipping test.");
    return;
  }

  const runId = runWithLeads.id;
  const agentId = runWithLeads.triggeredBy;
  console.log(`Testing with ScrapeRun ID: ${runId}`);
  console.log(`Original static leadsFound count in DB: ${runWithLeads.leadsFound}`);

  // Test logic for app/api/scrape-runs/route.ts
  const runIds = [runId];
  const activeLeadCounts = await prisma.lead.groupBy({
    by: ['scrapeRunId'],
    where: {
      scrapeRunId: { in: runIds },
      deletedAt: null,
    },
    _count: { id: true }
  });

  const countsMap = activeLeadCounts.reduce((acc, curr) => {
    acc[curr.scrapeRunId] = curr._count.id;
    return acc;
    }, {} as Record<string, number>);

  const initialDynamicCount = countsMap[runId] ?? 0;
  console.log(`Initial dynamic active leads count: ${initialDynamicCount}`);

  // Soft-delete one lead from this run
  const leadToSoftDelete = runWithLeads.leads.find(l => l.deletedAt === null);
  if (!leadToSoftDelete) {
    console.log("No active leads in this run to soft delete.");
    return;
  }

  console.log(`Soft-deleting lead ID: ${leadToSoftDelete.id}`);
  await prisma.lead.update({
    where: { id: leadToSoftDelete.id },
    data: { deletedAt: new Date() }
  });

  // Re-run dynamic count query
  const activeLeadCountsAfterDelete = await prisma.lead.groupBy({
    by: ['scrapeRunId'],
    where: {
      scrapeRunId: { in: runIds },
      deletedAt: null,
    },
    _count: { id: true }
  });

  const countsMapAfterDelete = activeLeadCountsAfterDelete.reduce((acc, curr) => {
    acc[curr.scrapeRunId] = curr._count.id;
    return acc;
  }, {} as Record<string, number>);

  const dynamicCountAfterDelete = countsMapAfterDelete[runId] ?? 0;
  console.log(`Dynamic active leads count after soft-delete: ${dynamicCountAfterDelete}`);

  if (dynamicCountAfterDelete !== initialDynamicCount - 1) {
    throw new Error(`Assertion failed: Expected ${initialDynamicCount - 1} leads, got ${dynamicCountAfterDelete}`);
  }
  console.log("✅ SUCCESS: Count successfully decremented after soft deletion!");

  // Restore the lead
  console.log(`Restoring lead ID: ${leadToSoftDelete.id}`);
  await prisma.lead.update({
    where: { id: leadToSoftDelete.id },
    data: { deletedAt: null }
  });

  const activeLeadCountsAfterRestore = await prisma.lead.groupBy({
    by: ['scrapeRunId'],
    where: {
      scrapeRunId: { in: runIds },
      deletedAt: null,
    },
    _count: { id: true }
  });

  const countsMapAfterRestore = activeLeadCountsAfterRestore.reduce((acc, curr) => {
    acc[curr.scrapeRunId] = curr._count.id;
    return acc;
  }, {} as Record<string, number>);

  const dynamicCountAfterRestore = countsMapAfterRestore[runId] ?? 0;
  console.log(`Dynamic active leads count after restore: ${dynamicCountAfterRestore}`);

  if (dynamicCountAfterRestore !== initialDynamicCount) {
    throw new Error(`Assertion failed: Expected ${initialDynamicCount} leads, got ${dynamicCountAfterRestore}`);
  }
  console.log("✅ SUCCESS: Count successfully restored!");
}

main()
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
