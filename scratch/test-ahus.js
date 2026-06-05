import { chromium } from 'playwright';

async function testAHUS() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to https://www.ahuscanada.org/links-resources/list-of-canadian-ahus-doctors/...");
    const response = await page.goto('https://www.ahuscanada.org/links-resources/list-of-canadian-ahus-doctors/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log("Status:", response.status());
    console.log("Title:", await page.title());

    // Take screenshot
    await page.screenshot({ path: 'scratch/ahus_home.png' });
    console.log("Screenshot saved to scratch/ahus_home.png");

    const bodyText = await page.innerText('body');
    console.log("First 2000 characters of page content:");
    console.log(bodyText.substring(0, 2000));

    // Let's find links or direct text layouts that represent doctors
    const details = await page.evaluate(() => {
      const allText = Array.from(document.querySelectorAll('div, p, span, li, h1, h2, h3, h4, td, th'))
        .map(el => ({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          text: el.innerText.trim()
        }))
        .filter(item => item.text.length > 0 && item.text.length < 500);

      const phoneLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(a => ({ text: a.innerText.trim(), href: a.href }));
      const emailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => ({ text: a.innerText.trim(), href: a.href }));

      return {
        phoneLinks,
        emailLinks,
        itemsSubset: allText.slice(0, 50)
      };
    });

    console.log("Phone links:", details.phoneLinks);
    console.log("Email links:", details.emailLinks);
    console.log("HTML Elements Subset (first 40):", details.itemsSubset.slice(0, 40));

  } catch (error) {
    console.error("Error during AHUS scraping test:", error);
  } finally {
    await browser.close();
  }
}

testAHUS();
