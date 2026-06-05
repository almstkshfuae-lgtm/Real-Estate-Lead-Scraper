import { chromium } from 'playwright';

async function main() {
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

  // Log console logs from the page
  page.on('console', msg => {
    console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
  });

  // Log uncaught page exceptions
  page.on('pageerror', err => {
    console.error(`[Browser PageError] ${err.message}`);
  });

  // Log failed network requests
  page.on('requestfailed', request => {
    console.warn(`[Browser RequestFailed] ${request.url()} - ${request.failure()?.errorText || 'failed'}`);
  });

  console.log("Navigating to google maps search...");
  try {
    const response = await page.goto('https://www.google.com/maps/search/real+estate+developer+in+dubai', { timeout: 45000, waitUntil: 'domcontentloaded' });
    console.log("Response Status:", response?.status());
    console.log("Page Title:", await page.title());
    console.log("Page URL:", page.url());
    const content = await page.content();
    console.log("Content length:", content.length);
    console.log("Snippet:", content.substring(0, 1000));
    
    // Save screenshot
    const screenshotPath = 'C:/Users/ceo/.gemini/antigravity-ide/brain/c371fb04-ae4d-4f34-8f1a-f4e3d2256e58/googlemaps.png';
    await page.screenshot({ path: screenshotPath });
    console.log("Screenshot saved to:", screenshotPath);
  } catch (err: any) {
    console.error("Navigation error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
