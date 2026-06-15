import { ScrapeQueueManager } from '../scraper-service/src/queue-manager.js';

// Setup Mock Prisma
const mockPrisma = {
  notification: {
    create: async ({ data }) => {
      console.log(`[MockPrisma] Notification created: "${data.title}" for agent ${data.agentId}`);
      return { id: 'mock-notif-id' };
    }
  },
  scrapeRun: {
    findUnique: async ({ where }) => {
      console.log(`[MockPrisma] findUnique called for run ${where.id}`);
      return { id: where.id, status: 'PENDING' };
    }
  }
};

const SECRET = 'mock-secret';

// Test 1: Sequential Execution
async function testSequential() {
  console.log('\n--- Test 1: Sequential Execution ---');
  const qm = new ScrapeQueueManager(mockPrisma, SECRET);
  qm.MAX_CONCURRENT_SCRAPES = 1;
  
  const order = [];
  
  const job1 = {
    runId: 'run-1',
    sources: ['sourceA'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-1') } }
  };
  
  const job2 = {
    runId: 'run-2',
    sources: ['sourceB'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-2') } }
  };

  const executeJob = async (job) => {
    console.log(`[Exec] Starting job ${job.runId}`);
    order.push(`start-${job.runId}`);
    const delay = job.runId === 'run-1' ? 1000 : 200;
    await new Promise(r => setTimeout(r, delay));
    console.log(`[Exec] Finished job ${job.runId}`);
    order.push(`finish-${job.runId}`);
  };

  await qm.enqueueJob(job1, executeJob);
  await qm.enqueueJob(job2, executeJob);

  // Wait for both to complete
  await new Promise(r => setTimeout(r, 1500));
  
  console.log('Execution order:', order);
  const expectedOrder = ['start-run-1', 'finish-run-1', 'start-run-2', 'finish-run-2'];
  const match = JSON.stringify(order) === JSON.stringify(expectedOrder);
  console.log(match ? '✅ Test 1 Passed' : '❌ Test 1 Failed');
  return match;
}

// Test 2: Watchdog Timeout
async function testWatchdogTimeout() {
  console.log('\n--- Test 2: Watchdog Timeout ---');
  const qm = new ScrapeQueueManager(mockPrisma, SECRET);
  
  // Set zombie timeout to 500ms for testing
  process.env.SCRAPER_ZOMBIE_KILL_MS = '500';

  const order = [];
  
  const job1 = {
    runId: 'run-timeout',
    sources: ['sourceA'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-timeout') } }
  };
  
  const job2 = {
    runId: 'run-next',
    sources: ['sourceB'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-next') } }
  };

  const executeJob = async (job) => {
    console.log(`[Exec] Starting job ${job.runId}`);
    order.push(`start-${job.runId}`);
    if (job.runId === 'run-timeout') {
      // Hang indefinitely to trigger timeout
      await new Promise(r => setTimeout(r, 2000));
    } else {
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`[Exec] Finished job ${job.runId}`);
    order.push(`finish-${job.runId}`);
  };

  await qm.enqueueJob(job1, executeJob);
  await qm.enqueueJob(job2, executeJob);

  // Wait for execution
  await new Promise(r => setTimeout(r, 2500));
  
  console.log('Execution order:', order);
  // Expect run-timeout to start, then watchdog triggers and cleans it up (starting run-next),
  // and finally run-timeout finishes execution in background (but cleanUp should ignore it).
  // Thus we expect: start-run-timeout, start-run-next, finish-run-next, finish-run-timeout
  const expectedOrder = ['start-run-timeout', 'start-run-next', 'finish-run-next', 'finish-run-timeout'];
  const match = JSON.stringify(order) === JSON.stringify(expectedOrder);
  console.log(`Active Scrapes at end: ${qm.activeScrapeJobs} (expected 0)`);
  console.log(`Queue length at end: ${qm.queue.length} (expected 0)`);
  
  const statusMatch = qm.activeScrapeJobs === 0 && qm.queue.length === 0;
  const result = match && statusMatch;
  console.log(result ? '✅ Test 2 Passed' : '❌ Test 2 Failed');
  return result;
}

// Test 3: Active Watchdog Database Cancellation
async function testDbCancellation() {
  console.log('\n--- Test 3: DB Watchdog Cancellation ---');
  const qm = new ScrapeQueueManager(mockPrisma, SECRET);
  
  process.env.SCRAPER_ZOMBIE_KILL_MS = '10000'; // high timeout

  const order = [];
  
  const job1 = {
    runId: 'run-cancel',
    sources: ['sourceA'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-cancel') } }
  };
  
  const job2 = {
    runId: 'run-after',
    sources: ['sourceB'],
    jobDiagnostics: { currentSource: 'none', currentPageUrl: 'none', pagesScraped: 0, browserInstance: { close: async () => console.log('[Browser] Closed run-after') } }
  };

  const executeJob = async (job) => {
    console.log(`[Exec] Starting job ${job.runId}`);
    order.push(`start-${job.runId}`);
    if (job.runId === 'run-cancel') {
      await new Promise(r => setTimeout(r, 2000));
    } else {
      await new Promise(r => setTimeout(r, 200));
    }
    console.log(`[Exec] Finished job ${job.runId}`);
    order.push(`finish-${job.runId}`);
  };

  await qm.enqueueJob(job1, executeJob);
  await qm.enqueueJob(job2, executeJob);

  // Trigger DB cancellation after 300ms
  setTimeout(() => {
    qm.cancelJob('run-cancel', 'agent-123');
  }, 300);

  // Wait for execution
  await new Promise(r => setTimeout(r, 2500));
  
  console.log('Execution order:', order);
  const expectedOrder = ['start-run-cancel', 'start-run-after', 'finish-run-after', 'finish-run-cancel'];
  const match = JSON.stringify(order) === JSON.stringify(expectedOrder);
  console.log(`Active Scrapes at end: ${qm.activeScrapeJobs} (expected 0)`);
  console.log(`Queue length at end: ${qm.queue.length} (expected 0)`);
  
  const statusMatch = qm.activeScrapeJobs === 0 && qm.queue.length === 0;
  const result = match && statusMatch;
  console.log(result ? '✅ Test 3 Passed' : '❌ Test 3 Failed');
  return result;
}

async function runAll() {
  const r1 = await testSequential();
  const r2 = await testWatchdogTimeout();
  const r3 = await testDbCancellation();
  
  if (r1 && r2 && r3) {
    console.log('\n🎉 ALL QUEUE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    console.error('\n🔴 SOME QUEUE TESTS FAILED!');
    process.exit(1);
  }
}

runAll();
