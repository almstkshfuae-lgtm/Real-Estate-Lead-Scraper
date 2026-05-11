import express from 'express';
import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const SECRET = process.env.SCRAPER_SECRET || 'scraper_secret_alpha_bravo';

app.post('/scrape', async (req, res) => {
  const { criteria, secret } = req.body;

  if (secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('Received scrape request:', criteria);

  // Background processing
  scrape(criteria).catch(console.error);

  res.json({ message: 'Scrape job started', status: 'processing' });
});

async function scrape(criteria) {
  console.log('Starting playwright browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Example: Scrape Bayut (simplified for demo)
    console.log('Navigating to source...');
    // await page.goto('https://www.bayut.com/for-sale/property/dubai/');
    
    // Scraper logic goes here
    
    console.log('Scrape completed for criteria:', criteria);
  } catch (error) {
    console.error('Scrape failed:', error);
  } finally {
    await browser.close();
  }
}

app.listen(PORT, () => {
  console.log(`Scraper service listening on port ${PORT}`);
});
