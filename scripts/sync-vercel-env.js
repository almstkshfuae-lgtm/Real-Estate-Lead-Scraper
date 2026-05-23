const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vercelPath = path.join(root, '.env.vercel');
const localPath = path.join(root, '.env.local');
const backupPath = path.join(root, `.env.local.bak.${Date.now()}`);

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const map = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map[key] = val;
  }
  return map;
}

function serializeEnv(map) {
  return Object.entries(map).map(([k, v]) => `${k}="${v}"`).join('\n') + '\n';
}

if (!fs.existsSync(vercelPath)) {
  console.error('.env.vercel not found, aborting.');
  process.exit(1);
}

const vercel = parseEnv(fs.readFileSync(vercelPath, 'utf8'));
let local = {};
if (fs.existsSync(localPath)) {
  local = parseEnv(fs.readFileSync(localPath, 'utf8'));
  fs.copyFileSync(localPath, backupPath);
  console.log(`Backed up existing .env.local to ${backupPath}`);
}

// Keys we DO NOT copy from Vercel into local to avoid accidental production DB creds
const denyPatterns = [/^DATABASE_URL$/i, /^MYSQL_/, /^MYSQLDATABASE$/i, /^MYSQL_PUBLIC_URL$/i, /^MYSQL_URL$/i, /^MYSQLROOT/gi, /^MYSQL_ROOT_/i, /^MUX_TOKEN_SECRET$/i, /^MUX_TOKEN_ID$/i];
const allowExplicit = new Set(['SCRAPER_SERVICE_URL','SCRAPER_SECRET','PROXY_SERVICE_URL','PROXY_API_KEY','BLOB_READ_WRITE_TOKEN','GOOGLE_AI_API_KEY','BITRIX24_TOKEN','BITRIX24_DOMAIN','WHATSAPP_TOKEN','JWT_SECRET']);

for (const [k, v] of Object.entries(vercel)) {
  const deny = denyPatterns.some(rx => rx.test(k));
  if (deny && !allowExplicit.has(k)) {
    // skip copying production DB and similar secrets
    continue;
  }
  if (!local[k] || local[k] === '' || allowExplicit.has(k)) {
    local[k] = v;
  }
}

fs.writeFileSync(localPath, serializeEnv(local), 'utf8');
console.log('.env.local updated with allowed values from .env.vercel');
console.log('If you do not want production values in local, review .env.local and revert from the backup if needed.');
