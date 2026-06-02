import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const { chromium } = await import('playwright');
  const { extractHNWILeads } = await import('../lib/ai');
  const { PrismaClient } = await import('@prisma/client');

  const prisma = new PrismaClient();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const username = "c102f22054215ac53ad6__cr.ae";
  const password = "d09431468dc25cfa";
  const host = "gw.dataimpulse.com";
  const port = "823";

  const contextOptions = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    proxy: {
      server: `http://${host}:${port}`,
      username: username,
      password: password
    }
  };

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const url = 'https://www.adgm.com';
  console.log(`Navigating to ${url}...`);

  try {
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const content = await page.content();

    console.log(`Successfully fetched page content. Title: "${title}". Length: ${content.length} chars.`);

    // Mock the scrapedData object
    const scrapedData = {
      url: url,
      name: 'ADGM Registered Entities',
      type: 'Company Registry',
      signals: ['Family Office', 'Fund Manager', 'Wealth Management', 'UHNW'],
      title: title,
      content: content
    };

    console.log('Running extractHNWILeads with Gemini...');
    const leads = await extractHNWILeads(scrapedData, {
      propertyTypes: [],
      budgetMin: 1000000,
      budgetMax: 10000000,
      emirates: [],
      relocated: false,
      excludeRental: true
    });

    console.log(`Extracted Leads count: ${leads.length}`);
    console.log('Extracted Leads:', JSON.stringify(leads, null, 2));

  } catch (err: any) {
    console.error("Error during test scrape:", err);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main();
