import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { prisma } from '../lib/prisma.js';

// Access the underlying raw client
const raw = (prisma as any).$raw;

async function runTest() {
  console.log('--- STARTING PRISMA PROXY BACKOFF TEST ---');

  // 1. Verify successful query resets or maintains attempts at 0
  try {
    console.log('Running normal query...');
    await prisma.user.findMany({ take: 1 });
    console.log('Normal query succeeded.');
  } catch (err) {
    console.log('Normal query failed (expected if DB not running, but continuing test):', err);
  }

  // 2. Mock raw client methods to simulate connection failures
  console.log('\nMocking database connection failures...');
  
  // Mock $disconnect and $connect to count/observe reconnect attempts
  let disconnectCalled = 0;
  let connectCalled = 0;
  
  raw.$disconnect = async () => {
    disconnectCalled++;
    console.log(`[Mock] $disconnect called (Total: ${disconnectCalled})`);
  };

  raw.$connect = async () => {
    connectCalled++;
    console.log(`[Mock] $connect called (Total: ${connectCalled})`);
    throw new Error("Can't reach database server at railway.internal:3306");
  };

  // Mock a model method to throw connection error
  const originalFindMany = raw.user.findMany;
  raw.user.findMany = async () => {
    const err = new Error("Can't reach database server");
    (err as any).name = 'PrismaClientInitializationError';
    throw err;
  };

  // 3. Trigger multiple queries in sequence and check exponential backoff delays
  for (let i = 1; i <= 2; i++) {
    console.log(`\n--- Triggering query #${i} ---`);
    const startTime = Date.now();
    try {
      await prisma.user.findMany({ take: 1 });
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.log(`Query #${i} failed as expected after ${elapsed}ms.`);
    }
  }

  // 4. Simulate db coming back online: make connection and query succeed
  console.log('\nSimulating database coming back online...');
  raw.$connect = async () => {
    connectCalled++;
    console.log(`[Mock] $connect called (Total: ${connectCalled})`);
    console.log('[Mock] $connect succeeded!');
  };

  raw.user.findMany = async () => {
    console.log('[Mock] findMany succeeded!');
    return [{ email: 'test@example.com' }];
  };

  // Trigger a query that should succeed and reset attempt counter
  console.log('\n--- Triggering query #3 (Should succeed) ---');
  try {
    const res = await prisma.user.findMany({ take: 1 });
    console.log('Query #3 succeeded! Result:', res);
  } catch (err) {
    console.error('Query #3 failed unexpected:', err);
  }

  // 5. Simulate another failure to verify it starts back from attempt 1
  console.log('\nSimulating database going offline again...');
  raw.user.findMany = async () => {
    const err = new Error("Can't reach database server");
    (err as any).name = 'PrismaClientInitializationError';
    throw err;
  };
  raw.$connect = async () => {
    connectCalled++;
    console.log(`[Mock] $connect called (Total: ${connectCalled})`);
    throw new Error("Can't reach database server");
  };

  console.log('\n--- Triggering query #4 (Should start from attempt 1) ---');
  const startTime = Date.now();
  try {
    await prisma.user.findMany({ take: 1 });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.log(`Query #4 failed as expected after ${elapsed}ms.`);
  }

  // Restore original methods
  raw.user.findMany = originalFindMany;
}

runTest().catch(console.error);
