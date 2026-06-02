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

  console.log("Navigating to adgm.com...");
  try {
    const response = await page.goto('https://www.adgm.com', { timeout: 30000, waitUntil: 'domcontentloaded' });
    console.log("Response Status:", response?.status());
    console.log("Page Title:", await page.title());
    console.log("Page URL:", page.url());
    const content = await page.content();
    console.log("Content length:", content.length);
    console.log("Snippet:", content.substring(0, 500));
  } catch (err: any) {
    console.error("Navigation error:", err.message);
  } finally {
    await browser.close();
  }
}

main();
