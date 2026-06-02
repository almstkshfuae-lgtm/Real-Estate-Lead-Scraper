import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const { getSecret } = await import('../lib/secrets');
  const secret = await getSecret("googleAiApiKey");
  console.log("SECRET googleAiApiKey:", secret);
}

main();
