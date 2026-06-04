var _a;
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const requiredKeys = [
    'DATABASE_URL',
    'SCRAPER_SERVICE_URL',
    'SCRAPER_SECRET'
];
const optionalKeys = [
    'DATAIMPULSE_PROXY_URL',
    'DATAIMPULSE_PROXY_USERNAME',
    'DATAIMPULSE_PROXY_PASSWORD',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_API_APPLICATION_CREDENTIALS',
    'BLOB_READ_WRITE_TOKEN'
];
const missing = requiredKeys.filter((key) => { var _a; return !process.env[key] || ((_a = process.env[key]) === null || _a === void 0 ? void 0 : _a.trim()) === ''; });
if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
}
const secret = (_a = process.env.SCRAPER_SECRET) !== null && _a !== void 0 ? _a : '';
if (secret.length !== 64 || !/^[0-9a-f]+$/i.test(secret)) {
    console.error('SCRAPER_SECRET must be a 64-character hex string.');
    console.error(`Found length ${secret.length}.`);
    process.exit(1);
}
const hasAiKey = optionalKeys.some((key) => { var _a; return !!process.env[key] && ((_a = process.env[key]) === null || _a === void 0 ? void 0 : _a.trim()) !== ''; });
if (!hasAiKey) {
    console.warn('Warning: No AI provider API key detected.');
    console.warn('Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or GOOGLE_API_APPLICATION_CREDENTIALS.');
}
console.log('✅ Required environment variables are present.');
console.log(`✅ SCRAPER_SECRET is valid (${secret.length} chars).`);
if (hasAiKey) {
    console.log('✅ At least one AI provider key is configured.');
}
console.log('Run this script with your local or production environment loaded, e.g.');
console.log('  SCRAPER_SERVICE_URL=https://... SCRAPER_SECRET=... tsx scratch/validate-secrets.ts');
