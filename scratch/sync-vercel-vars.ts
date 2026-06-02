import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load variables from .env.production first, then override with .env.local if present
dotenv.config({ path: path.resolve(process.cwd(), '.env.production'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

// Clean database URL to ensure connection limit is correct for production
const dbUrl = process.env.DATABASE_URL || "";
const cleanDbUrl = dbUrl.includes('connection_limit') 
  ? dbUrl 
  : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}connection_limit=10&socket_timeout=60000`;

const envs: Record<string, string> = {
  DATABASE_URL: cleanDbUrl,
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || "",
  JWT_SECRET: process.env.JWT_SECRET || "change-this-to-secure-random-string-production",
  SCRAPER_SECRET: process.env.SCRAPER_SECRET || "96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684",
  SCRAPER_SERVICE_URL: process.env.SCRAPER_SERVICE_URL || "https://scraper-service.railway.app"
};

async function main() {
  console.log('=== Syncing Production Environment Variables to Vercel ===');

  for (const [key, value] of Object.entries(envs)) {
    if (!value || value.includes('YOUR_')) {
      console.log(`⚠️ Skipping ${key} as it is empty or placeholder.`);
      continue;
    }

    console.log(`\nProcessing ${key}...`);

    // 1. Remove if exists
    try {
      console.log(`Removing old ${key} from Vercel Production...`);
      execSync(`npx vercel env rm ${key} production -y`, { stdio: 'inherit' });
    } catch (err) {
      console.log(`Note: ${key} was not found or could not be removed (this is normal if it didn't exist).`);
    }

    // 2. Add new value
    try {
      console.log(`Adding new ${key} to Vercel Production...`);
      const command = `echo "${value}" | npx vercel env add ${key} production`;
      execSync(command, { stdio: 'inherit' });
      console.log(`✅ Successfully set ${key} in Vercel Production!`);
    } catch (err: any) {
      console.error(`❌ Failed to set ${key}:`, err.message);
    }
  }

  console.log('\n=== Triggering Vercel Production Redeployment ===');
  try {
    execSync('npx vercel --prod --yes', { stdio: 'inherit' });
    console.log('\n✅ Vercel redeployment completed successfully!');
  } catch (err: any) {
    console.error('❌ Redeployment failed:', err.message);
  }
}

main().catch(console.error);
