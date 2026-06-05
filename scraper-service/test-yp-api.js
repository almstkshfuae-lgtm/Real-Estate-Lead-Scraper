import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log("Testing Yellow Pages API directly with proxy...");
  
  const username = process.env.DATAIMPULSE_PROXY_USERNAME;
  const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
  const host = process.env.DATAIMPULSE_PROXY_HOST || 'gw.dataimpulse.com';
  const port = process.env.DATAIMPULSE_PROXY_PORT || '823';

  let proxyConfig = null;
  if (username && password) {
    proxyConfig = {
      host: host,
      port: parseInt(port, 10),
      auth: {
        username: username,
        password: password
      }
    };
    console.log(`Using proxy: http://${host}:${port}`);
  } else {
    console.warn("No proxy credentials found. Running without proxy.");
  }

  try {
    const response = await axios.get('https://api.yellowpages.ae/api/new-search-products', {
      params: {
        page: 0,
        size: 12,
        keyword: 'Real Estate'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.yellowpages.ae',
        'Referer': 'https://www.yellowpages.ae/'
      },
      proxy: proxyConfig,
      timeout: 20000
    });
    
    console.log("Status:", response.status);
    console.log("Data length:", JSON.stringify(response.data).length);
    console.log("Data:", JSON.stringify(response.data).substring(0, 2000));
  } catch (err) {
    console.error("API Call Failed:", err.message);
    if (err.response) {
      console.error("Response Status:", err.response.status);
      console.error("Response Data:", err.response.data);
    }
  }
}

main();
