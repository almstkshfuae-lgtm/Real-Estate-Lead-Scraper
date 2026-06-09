import express from 'express';
import axios from 'axios';
import { prisma } from './src/prisma.js';
import { loadEnv } from './src/env-loader.js';
import { ScrapeQueueManager } from './src/queue-manager.js';
import { validateSelectors } from './src/selector-validator.js';
import { scrapeMultipleSources, scrapeSource, getSourceConfigMap, seedDefaultSources, PROXY_CONFIG } from './src/scraper-engine.js';
import { verifySourceCompletePipeline } from './verification-pipeline.js';
import { maskProxyUrl, parseProxyUrl } from './proxy-validator.js';

// 1. Initialize environment variables & configuration
const env = loadEnv();
const SECRET = env.SCRAPER_SECRET;
const PORT = env.PORT;

const app = express();
app.use(express.json());

// 2. Instantiate stateful Scrape Queue Manager
const queueManager = new ScrapeQueueManager(prisma, SECRET);

// ─── Health & Connection Test Endpoints ─────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'playwright-scraper',
    uptime: process.uptime(),
    queue: {
      active: queueManager.activeScrapeJobs,
      pending: queueManager.queue.length
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/test-connection', async (req, res) => {
  const { secret, proxyUrl } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ success: false, error: 'Invalid scraper secret' });
  }

  const result = {
    success: true,
    service: 'playwright-scraper',
    uptime: process.uptime(),
    proxy: null,
    timestamp: new Date().toISOString()
  };

  const resolvedProxyUrl = proxyUrl || PROXY_CONFIG.getProxyUrl();
  if (resolvedProxyUrl) {
    try {
      const parsed = parseProxyUrl(resolvedProxyUrl);
      const host = parsed ? new URL(parsed.server).hostname : '';
      const port = parsed ? parseInt(new URL(parsed.server).port, 10) || 80 : 80;

      const proxyCheck = await axios.get('https://api.ipify.org?format=json', {
        proxy: parsed ? {
          host,
          port,
          auth: parsed.username && parsed.password ? {
            username: parsed.username,
            password: parsed.password
          } : undefined
        } : false,
        httpsAgent: undefined,
        timeout: 8000
      });
      result.proxy = { reachable: true, ip: proxyCheck.data?.ip || 'unknown' };
    } catch (err) {
      result.proxy = { reachable: false, error: err.message };
    }
  }

  res.json(result);
});

// ─── Queue & Scraping Endpoints ──────────────────────────────────────────────

app.post('/scrape', async (req, res) => {
  const { sources, secret, proxyUrl, webhookUrl, runId, criteria, uaeComplianceMode, globalRateLimitDelay } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: 'sources array required' });
  }

  console.log('Received scrape request for sources:', sources, 'proxyUrl:', proxyUrl ? 'provided' : 'default', 'webhookUrl:', webhookUrl || 'none');

  const jobDiagnostics = {
    currentSource: 'none',
    currentPageUrl: 'none',
    pagesScraped: 0,
    browserInstance: null
  };

  const job = {
    runId,
    sources,
    proxyUrl,
    webhookUrl,
    criteria,
    uaeComplianceMode,
    globalRateLimitDelay,
    jobDiagnostics
  };

  queueManager.enqueueJob(job, (j) => scrapeMultipleSources(
    j.sources,
    j.proxyUrl,
    j.webhookUrl,
    j.runId,
    j.jobDiagnostics,
    j.criteria,
    j.uaeComplianceMode,
    j.globalRateLimitDelay
  ));

  res.json({
    message: 'Scrape job queued',
    status: 'queued',
    sources: sources,
    runId: runId,
    queuePosition: queueManager.queue.length
  });
});

app.get('/queue', (req, res) => {
  res.json(queueManager.getQueueStatus());
});

app.post('/scrape-source', async (req, res) => {
  const { sourceKey, secret, proxyUrl } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'Invalid source key' });
  }

  try {
    const sourceMap = await getSourceConfigMap();
    if (!sourceMap[sourceKey]) {
      return res.status(400).json({ error: 'Invalid source key' });
    }

    const content = await scrapeSource(sourceKey, proxyUrl);
    res.json({
      source: sourceKey,
      content: content,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Source scrape error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/sources', async (req, res) => {
  try {
    const sourceMap = await getSourceConfigMap();
    const sources = Object.values(sourceMap).map((config) => ({
      key: config.key,
      name: config.name,
      url: config.url,
      type: config.type,
      signals: config.signals,
      active: config.active,
      verificationStatus: config.verificationStatus,
      verifiedAt: config.verifiedAt
    }));
    res.json({ sources });
  } catch (error) {
    console.error('Failed to load source configs:', error);
    res.status(500).json({ error: 'Failed to load source configs' });
  }
});

// ─── Verification Endpoints ──────────────────────────────────────────────────

app.post('/verify-source', async (req, res) => {
  const { url, proxyUrl, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    console.log(`\n🔍 Starting verification for: ${url}`);
    const report = await verifySourceCompletePipeline(url, proxyUrl || PROXY_CONFIG.getProxyUrl(), null);

    return res.json({
      status: report.overallStatus,
      recommendation: report.recommendation,
      report: report
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      error: 'Verification pipeline failed',
      details: maskProxyUrl(error.message)
    });
  }
});

app.get('/verify-source/:sourceKey', async (req, res) => {
  const { sourceKey } = req.params;

  try {
    const source = await prisma.sourceConfig.findUnique({
      where: { key: sourceKey }
    });

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json({
      key: source.key,
      url: source.url,
      verificationStatus: source.verificationStatus,
      verifiedAt: source.verifiedAt,
      technicalAccessPassed: source.technicalAccessPassed,
      domDataPassed: source.domDataPassed,
      interactionsPassed: source.interactionsPassed,
      aiExtractionPassed: source.aiExtractionPassed,
      report: source.verificationReport,
      notes: source.verificationNotes
    });
  } catch (error) {
    console.error('Failed to fetch verification status:', error);
    res.status(500).json({ error: 'Failed to fetch verification status' });
  }
});

app.post('/create-source', async (req, res) => {
  const { key, url, name, type, signals, navigationSelectors, contentSelectors, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!key || !url || !name || !type) {
    return res.status(400).json({ error: 'Missing required fields: key, url, name, type' });
  }

  if (navigationSelectors) {
    const navVal = validateSelectors(navigationSelectors);
    if (!navVal.valid) {
      return res.status(400).json({ error: `Invalid navigation selectors: ${navVal.errors.join(', ')}` });
    }
  }
  if (contentSelectors) {
    const contentVal = validateSelectors(contentSelectors);
    if (!contentVal.valid) {
      return res.status(400).json({ error: `Invalid content selectors: ${contentVal.errors.join(', ')}` });
    }
  }

  try {
    const existing = await prisma.sourceConfig.findUnique({ where: { key } });
    if (existing) {
      return res.status(400).json({ error: 'Source key already exists' });
    }

    const source = await prisma.sourceConfig.create({
      data: {
        key,
        url,
        name,
        type,
        signals: signals || [],
        navigationSelectors: navigationSelectors || {},
        contentSelectors: contentSelectors || {},
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        active: true
      }
    });

    console.log(`✅ Source created: ${key} (${url})`);

    res.json({
      status: 'created',
      source: {
        key: source.key,
        url: source.url,
        name: source.name,
        type: source.type
      }
    });
  } catch (error) {
    console.error('Failed to create source:', error);
    res.status(500).json({ error: 'Failed to create source', details: maskProxyUrl(error.message) });
  }
});

app.post('/verify-sources-batch', async (req, res) => {
  const { urls, proxyUrl, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array required' });
  }

  try {
    console.log(`\n🔍 Starting batch verification for ${urls.length} sources...`);
    const results = [];
    const proxyConfig = proxyUrl || PROXY_CONFIG.getProxyUrl();

    for (const url of urls) {
      try {
        const report = await verifySourceCompletePipeline(url, proxyConfig, null);
        results.push({
          url: url,
          status: report.overallStatus,
          recommendation: report.recommendation,
          blockers: report.summary.blockers,
          warnings: report.summary.warnings
        });
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        results.push({
          url: url,
          status: 'ERROR',
          error: maskProxyUrl(error.message)
        });
      }
    }

    res.json({
      total: urls.length,
      approved: results.filter(r => r.status === 'APPROVED').length,
      rejected: results.filter(r => r.status === 'REJECTED').length,
      manualReview: results.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED').length,
      results: results
    });
  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({ error: 'Batch verification failed', details: maskProxyUrl(error.message) });
  }
});

app.post('/approve-source', async (req, res) => {
  const { sourceKey, verificationNotes, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'sourceKey required' });
  }

  try {
    const source = await prisma.sourceConfig.update({
      where: { key: sourceKey },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || 'Manually approved'
      }
    });

    res.json({
      status: 'approved',
      source: {
        key: source.key,
        verificationStatus: source.verificationStatus,
        verifiedAt: source.verifiedAt
      }
    });
  } catch (error) {
    console.error('Failed to approve source:', error);
    res.status(500).json({ error: 'Failed to approve source', details: maskProxyUrl(error.message) });
  }
});

app.post('/reject-source', async (req, res) => {
  const { sourceKey, reason, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!sourceKey) {
    return res.status(400).json({ error: 'sourceKey required' });
  }

  try {
    const source = await prisma.sourceConfig.update({
      where: { key: sourceKey },
      data: {
        verificationStatus: 'rejected',
        verificationNotes: reason || 'Manually rejected',
        active: false
      }
    });

    res.json({
      status: 'rejected',
      source: {
        key: source.key,
        verificationStatus: source.verificationStatus,
        active: source.active
      }
    });
  } catch (error) {
    console.error('Failed to reject source:', error);
    res.status(500).json({ error: 'Failed to reject source', details: maskProxyUrl(error.message) });
  }
});

// ─── Watchdogs & Lifecycle Management ────────────────────────────────────────

async function startActiveDbWatchdog() {
  const WATCHDOG_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - ZOMBIE_TIMEOUT_MS);
      const zombieRuns = await prisma.scrapeRun.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          startedAt: { lt: cutoff }
        },
        select: {
          id: true,
          triggeredBy: true,
          status: true,
          startedAt: true
        }
      });

      if (zombieRuns.length > 0) {
        console.log(`[ActiveWatchdog] Found ${zombieRuns.length} database zombie runs:`, zombieRuns.map(r => r.id));

        for (const run of zombieRuns) {
          try {
            await prisma.scrapeRun.update({
              where: { id: run.id },
              data: {
                status: 'FAILED',
                completedAt: new Date()
              }
            });
            console.log(`[ActiveWatchdog] Force-marked run ${run.id} as FAILED in DB.`);
          } catch (dbErr) {
            console.error(`[ActiveWatchdog] Failed to update run ${run.id} in DB:`, dbErr.message);
          }

          // Trigger stateful cancellation in queue manager
          await queueManager.cancelJob(run.id, run.triggeredBy);
        }
      }
    } catch (err) {
      console.error('[ActiveWatchdog] Error in active DB watchdog interval:', err.message);
    }
  }, WATCHDOG_INTERVAL_MS);
  console.log('🛡️  Active Database Watchdog initialized (runs every 2 minutes)');
}

async function startServer() {
  try {
    try {
      console.log('Seeding default scraper sources on startup...');
      await seedDefaultSources();
    } catch (seedErr) {
      console.error('Seeding default sources failed:', seedErr.message);
    }

    try {
      await startActiveDbWatchdog();
    } catch (watchdogErr) {
      console.error('Failed to start active DB watchdog:', watchdogErr.message);
    }

    const sourceMap = await getSourceConfigMap();
    const availableSources = Object.keys(sourceMap);
    const server = app.listen(PORT, () => {
      console.log(`🎯 Playwright Scraper Service listening on port ${PORT}`);
      console.log(`📍 Available sources: ${availableSources.join(', ')}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Shutting down scraper service gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await prisma.$disconnect();
          console.log('Prisma database connection closed successfully.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing Prisma database connection:', err);
          process.exit(1);
        }
      });

      setTimeout(() => {
        console.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to initialize source configs:', error);
    process.exit(1);
  }
}

startServer();

// Process-level fatal error handling
const handleFatalCrash = async (err, context) => {
  const errMsg = err?.message || String(err);
  const isFatal = errMsg.includes('ENOMEM') ||
                  errMsg.includes('out of memory') ||
                  errMsg.includes('DATABASE_URL') ||
                  errMsg.includes('PrismaClient');

  if (!isFatal) {
    console.warn(`⚠️ Non-fatal unhandled promise rejection caught (${context}):`, err);
    return;
  }

  console.error(`💥 FATAL CRASH: Uncaught ${context}:`, err);
  
  if (queueManager && queueManager.queue.length > 0) {
    const currentJob = queueManager.queue[0];
    if (currentJob && currentJob.webhookUrl && currentJob.runId) {
      console.error(`💥 Sending failure webhook for active job ${currentJob.runId} before crashing...`);
      try {
        await axios.post(currentJob.webhookUrl, {
          secret: SECRET,
          runId: currentJob.runId,
          isFailedSignal: true,
          error: `Fatal scraper service crash (${context}): ${err?.message || String(err)}`
        }, { timeout: 5000 });
      } catch (webhookErr) {
        console.error(`💥 Failed to send failure webhook for job ${currentJob.runId}:`, webhookErr.message);
      }
    }
  }
  process.exit(1);
};

process.on('uncaughtException', (err) => handleFatalCrash(err, 'Exception'));
process.on('unhandledRejection', (reason) => handleFatalCrash(reason, 'Rejection'));
