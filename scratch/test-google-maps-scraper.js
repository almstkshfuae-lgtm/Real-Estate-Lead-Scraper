import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeSource } from '../scraper-service/src/scraper-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../scraper-service/.env') });

async function main() {
  console.log('=== Test Scraper Engine Google Maps with Safe Interception and Resilient Selectors ===');
  
  process.env.USE_MOCK_DATA = 'false';

  try {
    const start = Date.now();
    console.log("Triggering scrapeSource('google-maps')...");
    const result = await scrapeSource('google-maps');
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    
    console.log(`\n🎉 Scraped 'google-maps' successfully in ${duration}s!`);
    console.log('--------------------------------------------------');
    console.log(`Title: ${result.title}`);
    console.log(`URL: ${result.url}`);
    console.log(`Pages Scraped: ${result.pagesScraped}`);
    console.log(`Content Length: ${result.contentLength} bytes`);
    console.log('--------------------------------------------------');
    console.log('Extracted Sample Content Preview:');
    console.log(result.content ? result.content.substring(0, 2000) : "No content returned");
  } catch (err) {
    console.error('❌ Scrape Failed:', err.message || err);
  }
}

main();
