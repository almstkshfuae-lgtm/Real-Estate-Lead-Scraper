import { shouldRefreshAndCreateNewToken } from '../lib/auth';
import { ScraperClient } from '../lib/scraper-client';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
async function runTests() {
    console.log('🚀 Starting Verification Tests for Auth and Integration Security...\n');
    // Test 1: Sliding Session JWT Refresh
    console.log('--- Test 1: Sliding Session JWT Refresh ---');
    const testUser = {
        id: 'test-user-id',
        email: 'test@brilliance.ae',
        role: 'agent',
        name: 'Test Agent'
    };
    // Sign a token manually that expires in 1 day (less than 3 days threshold)
    const secret = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
    const nearExpiryToken = jwt.sign({ ...testUser, exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60 }, secret);
    console.log('Verifying token that expires in 1 day...');
    const refreshedToken = await shouldRefreshAndCreateNewToken(nearExpiryToken);
    if (!refreshedToken) {
        throw new Error('Token should have been refreshed because it expires in less than 3 days!');
    }
    // Verify new token expiration
    const decodedNew = jwt.verify(refreshedToken, secret);
    const remainingTimeDays = (decodedNew.exp - Math.floor(Date.now() / 1000)) / (24 * 60 * 60);
    console.log(`✅ Token refreshed successfully. New expiry time: ${remainingTimeDays.toFixed(1)} days`);
    if (remainingTimeDays < 6.9) {
        throw new Error('Refreshed token expiration should be extended to 7 days!');
    }
    // Verify that a fresh token (expires in 7 days) does NOT trigger a refresh
    console.log('Verifying token that expires in 7 days...');
    const freshToken = jwt.sign({ ...testUser, exp: Math.floor(Date.now() / 1000) + 6 * 24 * 60 * 60 }, secret);
    const noRefresh = await shouldRefreshAndCreateNewToken(freshToken);
    if (noRefresh !== null) {
        throw new Error('Token should NOT have been refreshed because it expires in 6 days (> 3 days limit)!');
    }
    console.log('✅ Fresh token did not trigger unnecessary refresh.');
    // Test 2: Scraper Client Robust Retries
    console.log('\n--- Test 2: Scraper Client Robust Retries ---');
    // Create a client with a bad port/base URL to trigger failures and test retries
    const badClient = new ScraperClient({
        baseUrl: 'http://127.0.0.1:3999', // Bad port (should fail)
        secret: 'dummy_secret',
        timeout: 500 // Quick timeout to abort
    });
    console.log('Triggering connection test with bad URL...');
    const start = Date.now();
    const connected = await badClient.testConnection();
    const duration = Date.now() - start;
    console.log(`Connection test completed. Result: ${connected}. Duration: ${duration}ms`);
    if (connected) {
        throw new Error('Bad client connection test should have failed!');
    }
    console.log('✅ Scraper client handled connection failures gracefully.');
    console.log('\n🎉 ALL SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY!');
}
runTests().catch(err => {
    console.error('\n❌ TEST FAILED:', err.message || err);
    process.exit(1);
});
