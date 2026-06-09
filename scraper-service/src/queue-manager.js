import axios from 'axios';

// Helper for retrying webhook calls
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export class ScrapeQueueManager {
  constructor(prisma, secret) {
    this.prisma = prisma;
    this.secret = secret;
    this.queue = [];
    this.jobsState = new Map(); // runId -> { status, watchdogTimer, job }
    this.activeScrapeJobs = 0;
    this.MAX_CONCURRENT_SCRAPES = process.env.MAX_CONCURRENT_SCRAPES
      ? parseInt(process.env.MAX_CONCURRENT_SCRAPES, 10)
      : 2;
    this.executeFn = null;
  }

  enqueueJob(job, executeFn) {
    if (!this.executeFn) {
      this.executeFn = executeFn;
    }
    
    // Check if already in queue to prevent duplicate runs
    if (this.jobsState.has(job.runId)) {
      console.warn(`[Queue] Job ${job.runId} is already queued/running. Ignoring duplicate.`);
      return;
    }

    this.queue.push(job);
    this.jobsState.set(job.runId, {
      status: 'queued',
      watchdogTimer: null,
      job: job
    });

    console.log(`[Queue] Job ${job.runId} added to queue. Queue size: ${this.queue.length}`);
    this.processQueue().catch(err => console.error('[Queue] processQueue error:', err));
  }

  async processQueue() {
    // If we are already running the maximum concurrent jobs, stop starting new ones
    if (this.activeScrapeJobs >= this.MAX_CONCURRENT_SCRAPES) {
      return;
    }

    // Find the next job in the queue that has status === 'queued'
    const nextJobIdx = this.queue.findIndex(job => {
      const state = this.jobsState.get(job.runId);
      return state && state.status === 'queued';
    });

    if (nextJobIdx === -1) {
      return;
    }

    const currentJob = this.queue[nextJobIdx];
    const stateObj = this.jobsState.get(currentJob.runId);

    if (!stateObj) {
      // Job was cancelled/cleaned up before it could start
      this.queue.splice(nextJobIdx, 1);
      this.processQueue().catch(err => console.error('[Queue] processQueue post-skip error:', err));
      return;
    }

    stateObj.status = 'running';
    console.log(`[Queue] Starting concurrent job ${currentJob.runId}. Active: ${this.activeScrapeJobs + 1}/${this.MAX_CONCURRENT_SCRAPES}`);

    // Send Started webhook signal to Next.js
    if (currentJob.webhookUrl && currentJob.runId) {
      console.log(`[Queue] Sending started signal for job ${currentJob.runId} to webhook: ${currentJob.webhookUrl}`);
      try {
        await withRetry(() => axios.post(currentJob.webhookUrl, {
          secret: this.secret,
          runId: currentJob.runId,
          isStartedSignal: true
        }, { timeout: 15000 }), 3, 1000);
        console.log(`[Queue] Started signal sent for job ${currentJob.runId}`);
      } catch (err) {
        console.error(`[Queue] Failed to send started signal webhook for job ${currentJob.runId}:`, err.message);
      }
    }

    this.activeScrapeJobs++;

    // Setup local watchdog
    const ZOMBIE_KILL_MS = process.env.SCRAPER_ZOMBIE_KILL_MS
      ? parseInt(process.env.SCRAPER_ZOMBIE_KILL_MS, 10)
      : 8 * 60 * 1000; // 8 minutes default

    stateObj.watchdogTimer = setTimeout(async () => {
      console.error(`[Watchdog] Job ${currentJob.runId} exceeded ${ZOMBIE_KILL_MS / 60000}min hard limit. Force-killing.`);
      await this.cleanupJob(
        currentJob.runId, 
        'timeout', 
        `Job timeout: exceeded ${ZOMBIE_KILL_MS / 60000}-minute hard limit. Zombie process killed.`
      );
    }, ZOMBIE_KILL_MS);

    // Execute the job asynchronously to allow other queued jobs to start immediately
    (async () => {
      try {
        await this.executeFn(currentJob);
        await this.cleanupJob(currentJob.runId, 'finished');
      } catch (error) {
        console.error(`[Queue] Error running job ${currentJob.runId}:`, error);
        await this.cleanupJob(currentJob.runId, 'failed', error.message || String(error));
      }
    })();

    // Attempt to start more jobs if concurrency limit is not met
    this.processQueue().catch(err => console.error('[Queue] processQueue concurrent trigger error:', err));
  }

  async cancelJob(runId, agentId = null) {
    console.warn(`[Queue] Explicit cancellation requested for job ${runId}`);
    await this.cleanupJob(
      runId, 
      'cancelled', 
      'Job execution was force-cancelled by background watchdog.',
      agentId
    );
  }

  async cleanupJob(runId, terminationReason, optionalError = null, agentId = null) {
    const stateObj = this.jobsState.get(runId);
    if (!stateObj) return;

    // Prevent double cleanup
    if (stateObj.status === 'completed' || stateObj.status === 'failed' || stateObj.status === 'cancelled' || stateObj.status === 'timeout') {
      return;
    }

    const previousStatus = stateObj.status;
    stateObj.status = terminationReason === 'finished' ? 'completed' : terminationReason;

    console.log(`[Queue] Cleaning up job ${runId}. Reason: ${terminationReason}`);

    // Clear watchdog timer
    if (stateObj.watchdogTimer) {
      clearTimeout(stateObj.watchdogTimer);
      stateObj.watchdogTimer = null;
    }

    const job = stateObj.job;

    // Force close active browser context if present
    if (job.jobDiagnostics && job.jobDiagnostics.browserInstance) {
      console.warn(`[Queue] Closing active browser instance to reclaim memory...`);
      const browser = job.jobDiagnostics.browserInstance;
      try {
        await Promise.race([
          browser.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Browser close timeout')), 5000))
        ]);
        console.log(`[Queue] Active browser instance closed successfully.`);
      } catch (err) {
        console.error(`[Queue] Failed to close active browser instance:`, err.message);
      }
    }

    // Decrement active job count
    if (previousStatus === 'running') {
      this.activeScrapeJobs = Math.max(0, this.activeScrapeJobs - 1);
    }

    // Remove from queue array
    const index = this.queue.findIndex(j => j.runId === runId);
    if (index !== -1) {
      this.queue.splice(index, 1);
    }

    // Retain state object for 10 minutes to allow queries, then prune
    setTimeout(() => {
      this.jobsState.delete(runId);
    }, 10 * 60 * 1000);

    // Send failure webhook if failed or cancelled
    if (terminationReason !== 'finished' && job.webhookUrl && job.runId) {
      try {
        await withRetry(() => axios.post(job.webhookUrl, {
          secret: this.secret,
          runId: job.runId,
          isFailedSignal: true,
          error: optionalError || `Job terminated with status: ${terminationReason}`,
          diagnostics: {
            currentSource: job.jobDiagnostics?.currentSource || 'unknown',
            currentPageUrl: job.jobDiagnostics?.currentPageUrl || 'unknown',
            pagesScraped: job.jobDiagnostics?.pagesScraped || 0
          }
        }, { timeout: 15000 }), 3, 1000);
      } catch (e) {
        console.error(`[Queue] Failed to post failure signal to webhook for job ${runId}:`, e.message);
      }
    }

    // Add DB notification if requested
    if (agentId && this.prisma) {
      try {
        await this.prisma.notification.create({
          data: {
            agentId: agentId,
            title: 'Scraper Error: Timeout in Scrape Run',
            body: optionalError || `The scrape run was force-killed because it exceeded the maximum allowed duration.`,
            type: 'error',
            data: JSON.stringify({ runId: runId })
          }
        });
        console.log(`[Queue] Created database notification for agent ${agentId}`);
      } catch (err) {
        console.error(`[Queue] Failed to create db notification for run ${runId}:`, err.message);
      }
    }

    // Trigger next job if the completed job was running
    if (previousStatus === 'running') {
      this.processQueue().catch(err => console.error('[Queue] processQueue next job trigger error:', err));
    }
  }

  getQueueStatus() {
    return {
      activeScrapeJobs: this.activeScrapeJobs,
      maxConcurrent: this.MAX_CONCURRENT_SCRAPES,
      queueLength: this.queue.length,
      processing: this.activeScrapeJobs > 0,
      queue: this.queue.map((job, idx) => {
        const state = this.jobsState.get(job.runId);
        return {
          position: idx + 1,
          runId: job.runId,
          sources: job.sources,
          webhookUrl: job.webhookUrl,
          status: state ? state.status : 'unknown',
          currentSource: job.jobDiagnostics?.currentSource || 'none',
          currentPageUrl: job.jobDiagnostics?.currentPageUrl || 'none',
          pagesScraped: job.jobDiagnostics?.pagesScraped || 0
        };
      })
    };
  }
}
