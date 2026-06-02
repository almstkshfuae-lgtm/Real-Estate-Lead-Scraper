import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log("GOOGLE_AI_API_KEY:", process.env.GOOGLE_AI_API_KEY);
console.log("DATABASE_URL:", process.env.DATABASE_URL);
