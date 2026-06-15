console.log("Raw GOOGLE_AI_API_KEY at start:", process.env.GOOGLE_AI_API_KEY);

import dotenv from 'dotenv';
import path from 'path';

// Force override existing env variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.production.local'), override: true });

console.log("Raw GOOGLE_AI_API_KEY after .env.production.local:", process.env.GOOGLE_AI_API_KEY);

import { getAIConfig } from "../lib/ai";
import { getEnvVar } from "../lib/env";

async function main() {
  console.log("getEnvVar('GOOGLE_AI_API_KEY'):", getEnvVar('GOOGLE_AI_API_KEY'));
  const config = await getAIConfig();
  console.log("CONFIG:", config);
}

main().catch(console.error);
