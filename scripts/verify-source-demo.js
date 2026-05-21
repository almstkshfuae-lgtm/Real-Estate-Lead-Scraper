#!/usr/bin/env node

/**
 * Source Verification Pipeline - CLI Demo Script
 * 
 * Usage:
 *   node verify-source-demo.js <url> [proxyUrl]
 * 
 * Examples:
 *   node verify-source-demo.js https://www.example.com/members
 *   node verify-source-demo.js https://www.example.com/directory socks5://user:pass@proxy:port
 */

import fetch from 'node-fetch';
import readline from 'readline';

const SCRAPER_SERVICE_URL = process.env.SCRAPER_SERVICE_URL || 'http://localhost:3002';
const SECRET = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function formatStageResult(stage, result) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 STAGE: ${stage}`);
  console.log('='.repeat(60));

  if (result.passed) {
    console.log(`✅ Status: PASSED`);
  } else {
    console.log(`❌ Status: FAILED`);
  }

  if (result.issues && result.issues.length > 0) {
    console.log(`\n⚠️  Issues:`);
    result.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  if (result.checks) {
    console.log(`\n🔍 Checks:`);
    Object.entries(result.checks).forEach(([check, value]) => {
      const icon = value ? '✅' : '❌';
      console.log(`   ${icon} ${check.replace(/([A-Z])/g, ' $1').trim()}`);
    });
  }

  if (result.dataQuality !== undefined) {
    console.log(`\n📊 Data Quality Score: ${result.dataQuality}%`);
  }

  if (result.sampleElements && result.sampleElements.length > 0) {
    console.log(`\n🎯 Found Elements:`);
    result.sampleElements.forEach((elem) => {
      console.log(`   - ${elem.field}: ${elem.selector} (${elem.count} found)`);
      if (elem.sample) {
        console.log(`     Sample: "${elem.sample}..."`);
      }
    });
  }

  if (result.navigationElements) {
    const totalNav = Object.values(result.navigationElements)
      .reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\n🗺️  Navigation Elements Found: ${totalNav}`);
    Object.entries(result.navigationElements).forEach(([type, elements]) => {
      if (elements.length > 0) {
        console.log(`   ${type}:`);
        elements.forEach((elem) => {
          console.log(`     - ${elem.selector} (${elem.count})`);
        });
      }
    });
  }

  if (result.confidence !== undefined) {
    console.log(`\n🤖 AI Extraction Confidence: ${result.confidence}%`);
  }

  if (result.extractedData) {
    console.log(`\n📄 Extracted Sample:`);
    Object.entries(result.extractedData).forEach(([field, value]) => {
      console.log(`   ${field}: ${value}`);
    });
  }

  if (result.hallucinations && result.hallucinations.length > 0) {
    console.log(`\n⚠️  Potential Hallucinations:`);
    result.hallucinations.forEach((halluc) => {
      console.log(`   - ${halluc}`);
    });
  }
}

async function verifySource(url, proxyUrl = null) {
  console.log(`\n🔍 Starting Source Verification Pipeline`);
  console.log(`Target URL: ${url}`);
  console.log(`Service: ${SCRAPER_SERVICE_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    const response = await fetch(`${SCRAPER_SERVICE_URL}/verify-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: url,
        proxyUrl: proxyUrl,
        secret: SECRET
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`❌ Request failed: ${response.status}`);
      console.error(JSON.stringify(error, null, 2));
      return;
    }

    const result = await response.json();

    // Display pipeline progress
    console.log(`\n${'█'.repeat(60)}`);
    console.log(`VERIFICATION PIPELINE EXECUTION`);
    console.log(`${'█'.repeat(60)}\n`);

    // Stage results
    if (result.report.stages.technicalAccess) {
      formatStageResult('Technical Access Test', result.report.stages.technicalAccess);
    }

    if (result.report.stages.domData) {
      formatStageResult('DOM Data Verification', result.report.stages.domData);
    }

    if (result.report.stages.interactionMapping) {
      formatStageResult('Interaction Mapping', result.report.stages.interactionMapping);
    }

    if (result.report.stages.aiExtraction) {
      formatStageResult('AI Extraction Viability', result.report.stages.aiExtraction);
    }

    // Summary
    console.log(`\n${'█'.repeat(60)}`);
    console.log(`FINAL SUMMARY`);
    console.log(`${'█'.repeat(60)}\n`);

    console.log(`Overall Status: ${result.report.overallStatus}`);
    console.log(`Recommendation: ${result.report.recommendation}`);
    console.log(`\nTests Passed: ${result.report.summary.passedTests}/${result.report.summary.totalTests}`);

    if (result.report.summary.blockers.length > 0) {
      console.log(`\n🚫 Blocking Issues (${result.report.summary.blockers.length}):`);
      result.report.summary.blockers.forEach((blocker, i) => {
        console.log(`   ${i + 1}. ${blocker}`);
      });
    }

    if (result.report.summary.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.report.summary.warnings.length}):`);
      result.report.summary.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }

    // Next steps
    if (result.report.nextSteps && result.report.nextSteps.length > 0) {
      console.log(`\n📋 Recommended Next Steps:`);
      result.report.nextSteps.forEach((step, i) => {
        console.log(`   ${i + 1}. ${step}`);
      });
    }

    // Decision
    console.log(`\n${'='.repeat(60)}`);
    if (result.report.overallStatus === 'APPROVED') {
      console.log(`✅ DECISION: APPROVED FOR INTEGRATION`);
      console.log(`This source can be added to production immediately.`);
    } else if (result.report.overallStatus === 'REJECTED') {
      console.log(`❌ DECISION: REJECTED - HARD BLOCKS DETECTED`);
      console.log(`This source cannot be integrated. Find an alternative.`);
    } else if (result.report.overallStatus === 'MANUAL_REVIEW_REQUIRED') {
      console.log(`⚠️  DECISION: MANUAL REVIEW REQUIRED`);
      console.log(`Human review and testing is recommended.`);
    }
    console.log(`${'='.repeat(60)}\n`);

  } catch (error) {
    console.error(`❌ Error during verification:`, error);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`\n📋 Source Verification Pipeline - CLI Demo`);
    console.log(`${'='.repeat(60)}\n`);

    const url = await question('Enter target URL to verify: ');
    if (!url) {
      console.log('❌ URL is required');
      rl.close();
      process.exit(1);
    }

    const proxy = await question('Enter proxy URL (optional, press Enter to skip): ');
    
    await verifySource(url, proxy || null);
    rl.close();
  } else {
    const url = args[0];
    const proxy = args[1] || null;
    await verifySource(url, proxy);
  }
}

main().catch(console.error);
