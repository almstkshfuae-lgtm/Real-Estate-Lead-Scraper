/**
 * Programmatic Usage Examples - Source Verification Pipeline
 * 
 * Shows how to integrate the verification pipeline into your own code
 */

// ============================================
// EXAMPLE 1: Basic Single Source Verification
// ============================================

async function verifyAndCreateSource() {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  // Step 1: Verify the source
  console.log('🔍 Verifying source...');
  const verifyResponse = await fetch(`${SERVICE_URL}/verify-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://www.example.com/members',
      secret: SECRET
    })
  });

  const verificationResult = await verifyResponse.json();

  // Step 2: Check if approved
  if (verificationResult.report.overallStatus !== 'APPROVED') {
    console.error('❌ Source failed verification:', verificationResult.report.overallStatus);
    console.error('Blockers:', verificationResult.report.summary.blockers);
    return null;
  }

  console.log('✅ Source approved! Creating profile...');

  // Step 3: Extract selectors from verification report
  const selectors = {
    navigationSelectors: verificationResult.report.stages.interactionMapping.interactionSelectors,
    contentSelectors: extractContentSelectors(verificationResult.report.stages.domData)
  };

  // Step 4: Create the source
  const createResponse = await fetch(`${SERVICE_URL}/create-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: 'example_source',
      url: 'https://www.example.com/members',
      name: 'Example Members Directory',
      type: 'Members Directory',
      signals: ['Business Owner', 'Executive'],
      navigationSelectors: selectors.navigationSelectors,
      contentSelectors: selectors.contentSelectors,
      secret: SECRET
    })
  });

  const sourceCreated = await createResponse.json();
  console.log('✅ Source created:', sourceCreated);
  return sourceCreated;
}

function extractContentSelectors(domDataResult) {
  return {
    namePatterns: domDataResult.sampleElements
      .filter(e => e.field === 'name')
      .map(e => e.selector),
    companyPatterns: domDataResult.sampleElements
      .filter(e => e.field === 'company')
      .map(e => e.selector),
    rolePatterns: domDataResult.sampleElements
      .filter(e => e.field === 'role')
      .map(e => e.selector)
  };
}

// ============================================
// EXAMPLE 2: Batch Verification with Processing
// ============================================

async function batchVerifyAndProcess(urls) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  console.log(`🔄 Starting batch verification for ${urls.length} sources...`);

  const response = await fetch(`${SERVICE_URL}/verify-sources-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: urls,
      secret: SECRET
    })
  });

  const batchResult = await response.json();

  // Process results by status
  const approved = batchResult.results.filter(r => r.status === 'APPROVED');
  const rejected = batchResult.results.filter(r => r.status === 'REJECTED');
  const manualReview = batchResult.results.filter(r => r.status === 'MANUAL_REVIEW_REQUIRED');

  console.log(`\n📊 Results:`);
  console.log(`   ✅ Approved: ${approved.length}`);
  console.log(`   ❌ Rejected: ${rejected.length}`);
  console.log(`   ⚠️  Manual Review: ${manualReview.length}`);

  // Auto-create approved sources
  console.log(`\n⚙️  Creating approved sources...`);
  for (const result of approved) {
    try {
      // You would need to fetch the full report to get selectors
      const fullReport = await fetch(`${SERVICE_URL}/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: result.url,
          secret: SECRET
        })
      }).then(r => r.json());

      // Create source...
      console.log(`   ✅ Created: ${result.url}`);
    } catch (error) {
      console.error(`   ❌ Failed to create: ${result.url}`, error.message);
    }
  }

  // Report rejected sources
  if (rejected.length > 0) {
    console.log(`\n❌ Rejected Sources (need alternatives):`);
    rejected.forEach(result => {
      console.log(`   ${result.url}`);
      console.log(`      Blockers: ${result.blockers.join(', ')}`);
    });
  }

  // Flag manual review items
  if (manualReview.length > 0) {
    console.log(`\n⚠️  Manual Review Required:`);
    manualReview.forEach(result => {
      console.log(`   ${result.url}`);
      console.log(`      Warnings: ${result.warnings.join(', ')}`);
    });
  }

  return {
    approved,
    rejected,
    manualReview,
    summary: {
      total: batchResult.total,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      manualReviewCount: manualReview.length
    }
  };
}

// ============================================
// EXAMPLE 3: Error Handling & Retry Logic
// ============================================

async function verifyWithRetry(url, maxRetries = 3) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 Attempt ${attempt}/${maxRetries}: Verifying ${url}`);

      const response = await fetch(`${SERVICE_URL}/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url,
          secret: SECRET
        }),
        timeout: 120000 // 2 minute timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Verification complete: ${result.report.overallStatus}`);
      return result;

    } catch (error) {
      console.warn(`⚠️  Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.error(`❌ All retry attempts failed`);
        throw error;
      }

      // Exponential backoff
      const delayMs = Math.pow(2, attempt) * 5000;
      console.log(`⏳ Waiting ${delayMs / 1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

// ============================================
// EXAMPLE 4: Verification with Custom Proxy
// ============================================

async function verifyWithProxy(url, proxyUrl) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  console.log(`🔍 Verifying ${url} with proxy ${proxyUrl}`);

  const response = await fetch(`${SERVICE_URL}/verify-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: url,
      proxyUrl: proxyUrl, // Pass custom proxy
      secret: SECRET
    })
  });

  const result = await response.json();

  // Check if Cloudflare was bypassed
  if (result.report.stages.technicalAccess.checks.cloudflareDetected) {
    console.log('⚠️  Cloudflare still detected - try different proxy');
  } else {
    console.log('✅ Proxy successfully bypassed blocks');
  }

  return result;
}

// ============================================
// EXAMPLE 5: Monitoring & Analytics
// ============================================

async function generateVerificationReport() {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  // Get all sources
  const response = await fetch(`${SERVICE_URL}/sources`);
  const { sources } = await response.json();

  // Analyze verification status
  const stats = {
    total: sources.length,
    verified: 0,
    pending: 0,
    rejected: 0,
    manualReview: 0,
    byType: {}
  };

  const sources_by_status = {
    verified: [],
    pending: [],
    rejected: [],
    manual_review: []
  };

  for (const source of sources) {
    // Fetch verification details
    const detailResponse = await fetch(
      `${SERVICE_URL}/verify-source/${source.key}`
    );
    const detail = await detailResponse.json();

    const status = detail.verificationStatus || 'pending';
    
    if (status === 'verified') stats.verified++;
    else if (status === 'pending') stats.pending++;
    else if (status === 'rejected') stats.rejected++;
    else if (status === 'manual_review') stats.manualReview++;

    // Track by type
    if (!stats.byType[source.type]) {
      stats.byType[source.type] = { total: 0, verified: 0 };
    }
    stats.byType[source.type].total++;
    if (status === 'verified') stats.byType[source.type].verified++;

    // Store for reporting
    sources_by_status[status]?.push({
      key: source.key,
      url: source.url,
      type: source.type,
      verifiedAt: detail.verifiedAt
    });
  }

  // Generate report
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SOURCE VERIFICATION ANALYTICS REPORT`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  console.log(`Overall Statistics:`);
  console.log(`  Total Sources: ${stats.total}`);
  console.log(`  ✅ Verified: ${stats.verified} (${(stats.verified / stats.total * 100).toFixed(1)}%)`);
  console.log(`  ⏳ Pending: ${stats.pending}`);
  console.log(`  ❌ Rejected: ${stats.rejected}`);
  console.log(`  ⚠️  Manual Review: ${stats.manualReview}\n`);

  console.log(`By Source Type:`);
  Object.entries(stats.byType).forEach(([type, counts]) => {
    const verified = (counts.verified / counts.total * 100).toFixed(1);
    console.log(`  ${type}: ${counts.verified}/${counts.total} verified (${verified}%)`);
  });

  if (sources_by_status.rejected.length > 0) {
    console.log(`\n❌ Rejected Sources (${sources_by_status.rejected.length}):`);
    sources_by_status.rejected.forEach(s => {
      console.log(`   - ${s.key}: ${s.url}`);
    });
  }

  if (sources_by_status.manual_review.length > 0) {
    console.log(`\n⚠️  Manual Review (${sources_by_status.manual_review.length}):`);
    sources_by_status.manual_review.forEach(s => {
      console.log(`   - ${s.key}: ${s.url}`);
    });
  }

  console.log(`${'='.repeat(60)}\n`);

  return stats;
}

// ============================================
// EXAMPLE 6: Integration with Database
// ============================================

async function syncVerificationToDatabase(prisma) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  // Get all pending sources
  const pendingSources = await prisma.sourceConfig.findMany({
    where: { verificationStatus: 'pending' }
  });

  console.log(`⏳ Re-verifying ${pendingSources.length} pending sources...`);

  for (const source of pendingSources) {
    try {
      const response = await fetch(`${SERVICE_URL}/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: source.url,
          secret: SECRET
        })
      });

      const result = await response.json();

      // Update database
      await prisma.sourceConfig.update({
        where: { id: source.id },
        data: {
          verificationStatus: result.report.overallStatus === 'APPROVED' ? 'verified' : 
                            result.report.overallStatus === 'REJECTED' ? 'rejected' : 
                            'manual_review',
          verificationReport: result.report,
          verifiedAt: new Date(),
          technicalAccessPassed: result.report.stages.technicalAccess?.passed || false,
          domDataPassed: result.report.stages.domData?.passed || false,
          interactionsPassed: !result.report.stages.interactionMapping?.warning,
          aiExtractionPassed: result.report.stages.aiExtraction?.passed || false,
          verificationNotes: result.report.summary.blockers[0] || result.report.summary.warnings[0] || 'Verification complete'
        }
      });

      console.log(`✅ ${source.key}: ${result.report.overallStatus}`);
    } catch (error) {
      console.error(`❌ ${source.key}: ${error.message}`);
    }
  }

  console.log(`✅ Sync complete`);
}

// ============================================
// EXAMPLE 7: Manual Approval Workflow
// ============================================

async function manuallyApproveSource(sourceKey, notes) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  console.log(`⚠️  Manually approving: ${sourceKey}`);
  console.log(`   Notes: ${notes}`);

  const response = await fetch(`${SERVICE_URL}/approve-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceKey: sourceKey,
      verificationNotes: notes,
      secret: SECRET
    })
  });

  const result = await response.json();
  console.log(`✅ Approved: ${result.source.key}`);
  console.log(`   Status: ${result.source.verificationStatus}`);
  console.log(`   Verified: ${result.source.verifiedAt}`);

  return result;
}

async function manuallyRejectSource(sourceKey, reason) {
  const SECRET = process.env.SCRAPER_SECRET;
  const SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';

  console.log(`❌ Rejecting: ${sourceKey}`);
  console.log(`   Reason: ${reason}`);

  const response = await fetch(`${SERVICE_URL}/reject-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceKey: sourceKey,
      reason: reason,
      secret: SECRET
    })
  });

  const result = await response.json();
  console.log(`✅ Rejected: ${result.source.key}`);
  console.log(`   Status: ${result.source.verificationStatus}`);
  console.log(`   Active: ${result.source.active}`);

  return result;
}

// ============================================
// Export for use in other modules
// ============================================

export {
  verifyAndCreateSource,
  batchVerifyAndProcess,
  verifyWithRetry,
  verifyWithProxy,
  generateVerificationReport,
  syncVerificationToDatabase,
  manuallyApproveSource,
  manuallyRejectSource
};

// ============================================
// Example usage (uncomment to run)
// ============================================

/*
async function main() {
  // Example 1: Verify and create single source
  // await verifyAndCreateSource();

  // Example 2: Batch verify multiple sources
  // await batchVerifyAndProcess([
  //   'https://example1.com/members',
  //   'https://example2.com/directory'
  // ]);

  // Example 3: Verify with retry
  // await verifyWithRetry('https://example.com/members');

  // Example 5: Analytics report
  // await generateVerificationReport();

  // Example 7: Manual approval
  // await manuallyApproveSource('source_key', 'Verified manually on 2026-05-21');
}

main().catch(console.error);
*/
