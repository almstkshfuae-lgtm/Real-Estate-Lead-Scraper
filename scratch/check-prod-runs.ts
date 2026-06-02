import { PrismaClient } from '@prisma/client';

const prodDatabaseUrl = "mysql://root:HtkOvJUqWyKeyjmLRyxvWfuajRdbtDAz@viaduct.proxy.rlwy.net:33196/railway?connection_limit=10&socket_timeout=60000";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: prodDatabaseUrl
    }
  }
});

async function main() {
  console.log('Querying PRODUCTION ScrapeRun history...');
  try {
    const runs = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10
    });
    console.log(`Found ${runs.length} ScrapeRuns in production:`);
    for (const run of runs) {
      console.log(`\n----------------------------------------`);
      console.log(`Run ID: ${run.id}`);
      console.log(`Triggered By: ${run.triggeredBy}`);
      console.log(`Started At: ${run.startedAt}`);
      console.log(`Completed At: ${run.completedAt || 'Running / Interrupted'}`);
      console.log(`Status: ${run.status}`);
      console.log(`Leads Found: ${run.leadsFound}`);
      console.log(`Sources: ${run.sources}`);
      console.log(`Log URL: ${run.logUrl || 'None'}`);

      if (run.logUrl) {
        console.log('Fetching log content...');
        try {
          const res = await fetch(run.logUrl);
          if (res.ok) {
            const logContent = await res.json();
            console.log('Scrape Logs Summary (Last 5 steps):');
            console.log(JSON.stringify(logContent.slice(-5), null, 2));
          } else {
            console.log('Failed to fetch log file:', res.statusText);
          }
        } catch (fetchErr: any) {
          console.log('Error fetching log file:', fetchErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error('Failed to query ScrapeRun history:', err.message || err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
