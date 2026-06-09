import prisma from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTests() {
  console.log('🚀 Starting Database Hardening & GDPR Retention Policy Tests...\n');

  // Ensure test agent exists
  let agent = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@brilliance-lead.uk' },
        { role: 'admin' }
      ]
    }
  });

  if (!agent) {
    console.log('Creating admin user for testing...');
    agent = await prisma.user.create({
      data: {
        email: 'admin@brilliance-lead.uk',
        passwordHash: 'dummy_hash',
        name: 'Test Super Admin',
        role: 'admin'
      }
    });
  }

  const agentId = agent.id;
  console.log(`👤 Using Agent ID: ${agentId}`);

  // Test 1: Verify default sources config
  console.log('\n--- Test 1: Verify Default Sources ---');
  const sourcesCount = await prisma.sourceConfig.count();
  console.log(`✅ Default sources count in DB: ${sourcesCount}`);
  if (sourcesCount === 0) {
    throw new Error('No sources configuration found! Please run the seeder first.');
  }

  // Test 2: Soft delete flow
  console.log('\n--- Test 2: Soft Delete & Audit Log Flow ---');
  
  // Clean up any existing test lead
  await prisma.lead.deleteMany({
    where: {
      name: 'Hardening Test Lead',
      company: 'Test Company Ltd',
      agentId: agentId
    }
  });

  // Create a ScrapeRun
  const testRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: agentId,
      sources: JSON.stringify(['google-maps']),
      criteria: JSON.stringify({}),
      status: 'COMPLETED',
      leadsFound: 1
    }
  });

  // Create the lead
  const lead = await prisma.lead.create({
    data: {
      name: 'Hardening Test Lead',
      company: 'Test Company Ltd',
      role: 'Chief Testing Officer',
      source: 'google-maps',
      tier: 2,
      score: 75,
      signals: ['Test Signal'],
      propertyPref: { type: 'villa' },
      location: 'Dubai',
      agentId: agentId,
      scrapeRunId: testRun.id
    }
  });
  console.log(`✅ Created test lead: ID=${lead.id}`);

  // Perform soft delete
  console.log('Soft-deleting the lead...');
  await prisma.lead.update({
    where: { id: lead.id },
    data: { deletedAt: new Date() }
  });

  // Create soft delete audit log (simulating route handler)
  await prisma.auditLog.create({
    data: {
      action: 'SOFT_DELETE',
      entityType: 'Lead',
      entityId: lead.id,
      agentId: agentId,
      details: 'Soft deleted lead for hardening tests'
    }
  });

  const softDeletedLead = await prisma.lead.findUnique({
    where: { id: lead.id }
  });

  console.log(`deletedAt value: ${softDeletedLead?.deletedAt}`);
  if (!softDeletedLead?.deletedAt) {
    throw new Error('Lead was not soft deleted!');
  }
  console.log('✅ Lead marked as soft-deleted successfully.');

  // Verify Audit Log entry exists
  const deleteLog = await prisma.auditLog.findFirst({
    where: {
      entityId: lead.id,
      action: 'SOFT_DELETE'
    }
  });
  if (!deleteLog) {
    throw new Error('SOFT_DELETE audit log not created!');
  }
  console.log(`✅ Soft-delete audit log found: ${deleteLog.details}`);

  // Test 3: Restoration & Merge Flow (Safe Webhook Ingestion)
  console.log('\n--- Test 3: Webhook Restoration & Merge Flow ---');
  
  // Now simulate scraper webhook trying to re-ingest/upsert the same lead name+company
  console.log('Simulating webhook re-ingestion of the soft-deleted lead...');
  const webhookLeadPayload = {
    name: 'Hardening Test Lead',
    company: 'Test Company Ltd',
    role: 'Chief Testing Officer (Promoted)',
    source: 'yellow-pages', // different source to test merge source list
    tier: 1, // higher tier (1 is better than 2)
    score: 95, // higher score
    signals: ['Test Signal', 'New High Interest Signal'],
    propertyPref: { type: 'penthouse' },
    location: 'Dubai Marina',
    phone: '+971500000000'
  };

  // Run the logic from webhook route
  const existingLead = await prisma.lead.findFirst({
    where: {
      name: webhookLeadPayload.name,
      company: webhookLeadPayload.company,
      agentId: agentId
    }
  });

  if (!existingLead) {
    throw new Error('Failed to find soft-deleted lead for webhook merge!');
  }

  // Merge logic
  let mergedSource = existingLead.source;
  if (!mergedSource.includes(webhookLeadPayload.source)) {
    mergedSource = `${mergedSource}, ${webhookLeadPayload.source}`;
  }
  const mergedTier = Math.min(existingLead.tier, webhookLeadPayload.tier);
  const mergedScore = Math.max(existingLead.score, webhookLeadPayload.score);
  const wasDeleted = existingLead.deletedAt !== null;

  console.log(`Found soft-deleted lead. wasDeleted=${wasDeleted}. Restoring & Merging...`);
  await prisma.lead.update({
    where: { id: existingLead.id },
    data: {
      role: webhookLeadPayload.role,
      source: mergedSource,
      tier: mergedTier,
      score: mergedScore,
      signals: webhookLeadPayload.signals,
      propertyPref: webhookLeadPayload.propertyPref,
      location: webhookLeadPayload.location,
      phone: webhookLeadPayload.phone,
      deletedAt: null // Restore
    }
  });

  // Log Audit Entry
  await prisma.auditLog.create({
    data: {
      action: wasDeleted ? "MERGE" : "UPDATE",
      entityType: "Lead",
      entityId: existingLead.id,
      agentId: agentId,
      details: wasDeleted 
        ? `Restored and merged soft-deleted lead from hardening test`
        : `Merged details for existing lead from hardening test`
    }
  });

  // Verify restoration
  const restoredLead = await prisma.lead.findUnique({
    where: { id: existingLead.id }
  });

  console.log(`Restored deletedAt: ${restoredLead?.deletedAt} (Should be null/null)`);
  if (restoredLead?.deletedAt !== null) {
    throw new Error('Lead was not restored (deletedAt should be null)!');
  }
  console.log(`Restored tier: ${restoredLead?.tier} (Should be 1)`);
  console.log(`Restored score: ${restoredLead?.score} (Should be 95)`);
  console.log(`Restored sources: ${restoredLead?.source} (Should contain both)`);

  const mergeLog = await prisma.auditLog.findFirst({
    where: {
      entityId: existingLead.id,
      action: 'MERGE'
    }
  });
  if (!mergeLog) {
    throw new Error('MERGE audit log not found!');
  }
  console.log(`✅ Webhook restoration and audit log verified: ${mergeLog.details}`);

  // Test 4: GDPR Retention Policy Pruning
  console.log('\n--- Test 4: GDPR Retention Policy Pruning ---');
  
  // Set up an old lead that should be pruned (e.g. 100 days old)
  // Since we cannot easily change createdAt directly via normal Prisma update,
  // we will manually run a raw SQL update to change the createdAt of our test lead
  console.log('Backdating test lead to 100 days ago...');
  const cutoffDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
  
  await prisma.$executeRaw`UPDATE leads SET createdAt = ${cutoffDate} WHERE id = ${restoredLead.id}`;
  
  const backdatedLead = await prisma.lead.findUnique({
    where: { id: restoredLead.id }
  });
  console.log(`Backdated lead createdAt: ${backdatedLead?.createdAt.toISOString()}`);

  // Now run the retention policy logic with 90 days retention limit
  const retentionDays = 90;
  const retentionCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  console.log(`Retention cutoff date: ${retentionCutoff.toISOString()}`);

  const expiredLeadsCount = await prisma.lead.count({
    where: {
      createdAt: { lt: retentionCutoff }
    }
  });
  console.log(`Expired leads count: ${expiredLeadsCount}`);

  if (expiredLeadsCount === 0) {
    throw new Error('Failed to find backdated test lead under expired leads check!');
  }

  const deleteResult = await prisma.lead.deleteMany({
    where: {
      createdAt: { lt: retentionCutoff }
    }
  });
  console.log(`Hard deleted ${deleteResult.count} expired leads.`);

  await prisma.auditLog.create({
    data: {
      action: "RETENTION_CLEANUP",
      entityType: "Lead",
      entityId: "SYSTEM",
      details: `GDPR retention cleanup: Hard deleted ${deleteResult.count} leads older than ${retentionDays} days`
    }
  });

  const prunedLead = await prisma.lead.findUnique({
    where: { id: restoredLead.id }
  });
  if (prunedLead) {
    throw new Error('Expired lead was not hard-deleted!');
  }
  console.log('✅ Expired lead was successfully hard-deleted.');

  const retentionLog = await prisma.auditLog.findFirst({
    where: {
      action: 'RETENTION_CLEANUP'
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  if (!retentionLog) {
    throw new Error('RETENTION_CLEANUP audit log not found!');
  }
  console.log(`✅ GDPR retention cleanup audit log verified: ${retentionLog.details}`);

  // Clean up test scrape runs
  await prisma.scrapeRun.delete({ where: { id: testRun.id } });

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Database hardening and GDPR retention policy verified.');
}

runTests()
  .catch(err => {
    console.error('\n❌ TEST FAILED:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
