import prisma from '../lib/prisma';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTests() {
  console.log('🚀 Starting Soft-Delete Bypass Security Verification Tests...\n');

  // 1. Get or create test agent/admin
  let agent = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'admin@brilliance-lead.uk' },
        { role: 'admin' }
      ]
    }
  });

  if (!agent) {
    console.log('👤 Creating admin user for testing...');
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

  // Clean up any old test leads
  await prisma.lead.deleteMany({
    where: {
      name: 'Soft Delete Security Test Lead',
      agentId: agentId
    }
  });

  // Create a ScrapeRun
  const testRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: agentId,
      sources: JSON.stringify(['test-source']),
      criteria: JSON.stringify({}),
      status: 'COMPLETED',
      leadsFound: 1
    }
  });

  // 2. Create an active lead
  console.log('\n--- Step 1: Create an Active Lead ---');
  const lead = await prisma.lead.create({
    data: {
      name: 'Soft Delete Security Test Lead',
      company: 'Security Labs Inc',
      role: 'Security Analyst',
      source: 'test-source',
      tier: 1,
      score: 95,
      signals: ['UHNW'],
      propertyPref: { type: 'apartment' },
      location: 'Downtown Dubai',
      agentId: agentId,
      scrapeRunId: testRun.id
    }
  });
  console.log(`✅ Created test lead: ID=${lead.id}`);

  // 3. Test retrieval using new query format on active lead
  console.log('\n--- Step 2: Query Active Lead with New Code ---');
  const activeLeadCheck = await prisma.lead.findFirst({
    where: { id: lead.id, deletedAt: null }
  });
  if (!activeLeadCheck) {
    throw new Error('Could not retrieve active lead using new query format!');
  }
  console.log(`✅ Active lead found: Name="${activeLeadCheck.name}"`);

  // 4. Soft delete the lead
  console.log('\n--- Step 3: Soft-Delete the Lead ---');
  const softDeletedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { deletedAt: new Date() }
  });
  console.log(`✅ Soft-deleted lead. deletedAt value: ${softDeletedLead.deletedAt}`);

  // 5. Test retrieval on soft-deleted lead using OLD code (Soft-Delete Bypass Vulnerability)
  console.log('\n--- Step 4: Verify Old Query Format Bypassed Soft-Delete ---');
  const oldBypassLead = await prisma.lead.findUnique({
    where: { id: lead.id }
  });
  if (!oldBypassLead) {
    throw new Error('Test lead vanished completely!');
  }
  console.log(`⚠️ OLD Code (findUnique) returned soft-deleted lead: ID=${oldBypassLead.id}, Name="${oldBypassLead.name}"`);
  console.log(`   This confirms the Soft-Delete Bypass vulnerability was present in the old implementation.`);

  // 6. Test retrieval on soft-deleted lead using NEW code
  console.log('\n--- Step 5: Verify New Query Format Blocks Soft-Deleted Lead ---');
  const newSecureLead = await prisma.lead.findFirst({
    where: { id: lead.id, deletedAt: null }
  });
  if (newSecureLead) {
    throw new Error('Vulnerability remains: New query format returned soft-deleted lead!');
  }
  console.log(`✅ Success: New query format (findFirst + deletedAt: null) returned null for soft-deleted lead.`);

  // 7. Test collision/duplicate check on soft-deleted lead
  console.log('\n--- Step 6: Verify Duplication Check Ignores Soft-Deleted Lead ---');
  const existingByUnique = await prisma.lead.findFirst({
    where: {
      id: { not: lead.id },
      name: 'Soft Delete Security Test Lead',
      company: 'Security Labs Inc',
      agentId: agentId,
      deletedAt: null
    }
  });
  if (existingByUnique) {
    throw new Error('Collision check failed: flagged duplicate against soft-deleted lead!');
  }
  console.log('✅ Success: Collision check returned null, allowing a new lead to be created.');

  // Clean up
  console.log('\n--- Cleaning up ---');
  await prisma.lead.delete({
    where: { id: lead.id }
  });
  await prisma.scrapeRun.delete({
    where: { id: testRun.id }
  });
  console.log('✅ Deleted test records.');

  console.log('\n🎉 ALL SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests()
  .catch(err => {
    console.error('\n❌ TEST FAILED:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
