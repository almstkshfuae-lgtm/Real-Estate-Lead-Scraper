import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Mask credentials in database connection string
 */
export function maskDatabaseUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  if (process.env.NODE_ENV === 'production') {
    return 'mysql://[REDACTED_USER]:[REDACTED_PASS]@[REDACTED_HOST]:[REDACTED_PORT]/[REDACTED_DB]';
  }
  try {
    const parsed = new URL(urlStr);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch (e) {
    return urlStr.replace(/(mysql:\/\/([^:]+):)([^@]+)(@)/, '$1****$4');
  }
}

/**
 * Mask hex secrets
 */
export function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '';
  if (secret.length <= 8) return '****';
  return `${secret.substring(0, 4)}...${secret.substring(secret.length - 4)}`;
}

/**
 * Load environment variables from multiple standard paths
 */
export function loadEnv() {
  const pathsToTry = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../.env.local'),
    path.resolve(__dirname, '../../.env')
  ];

  console.log('[EnvLoader] Scanning for environment files...');
  for (const p of pathsToTry) {
    const res = dotenv.config({ path: p });
    if (!res.error) {
      const displayPath = process.env.NODE_ENV === 'production' ? path.basename(p) : p;
      console.log(`[EnvLoader] Loaded variables from: ${displayPath}`);
    }
  }

  // Fallback for DATABASE_URL
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL || '';
  }

  const maskedDbUrl = maskDatabaseUrl(process.env.DATABASE_URL);
  console.log('[EnvLoader] Resolved DATABASE_URL:', maskedDbUrl ? maskedDbUrl : '(empty)');

  let secret = process.env.SCRAPER_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: SCRAPER_SECRET environment variable is missing in production!");
    }
    console.warn("[EnvLoader] WARNING: SCRAPER_SECRET environment variable is missing. Using development fallback secret.");
    secret = '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684';
    process.env.SCRAPER_SECRET = secret;
  } else {
    console.log('[EnvLoader] Resolved SCRAPER_SECRET:', maskSecret(secret));
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL,
    SCRAPER_SECRET: secret,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY || '',
    GOOGLE_AI_MODEL: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
    PORT: process.env.PORT || 3002
  };
}
