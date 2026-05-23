import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const username = process.env.OXYLABS_PROXY_USERNAME;
const password = process.env.OXYLABS_PROXY_PASSWORD;
const host = process.env.OXYLABS_PROXY_HOST || 'pr.oxylabs.io';
const port = process.env.OXYLABS_PROXY_PORT || '10000';
const scheme = process.env.OXYLABS_PROXY_SCHEME || 'http';
const proxyUrl = username && password && host && port
  ? `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`
  : 'missing';

console.log('username=', username);
console.log('password=', password ? '[HIDDEN]' : 'missing');
console.log('host=', host);
console.log('port=', port);
console.log('proxyUrl=', proxyUrl);
