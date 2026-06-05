import { chromium } from 'playwright';

async function testCPSAPagination() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://search.cpsa.ca/', { waitUntil: 'domcontentloaded' });
    await page.fill('input[id*="txtCity"]', 'Calgary');
    await page.click('input[id*="btnSearch"]');
    await page.waitForTimeout(5000);

    const paginationInfo = await page.evaluate(() => {
      // Find the grid view results table
      const grid = document.querySelector('#MainContent_physicianSearchView_gvResults');
      if (!grid) return { foundGrid: false };

      // Look for pagination row (usually the last row or inside a specific class in ASP.NET GridView)
      const pageLinks = Array.from(grid.querySelectorAll('tr.pager, tr:last-child a, .pagination a, [href*="Page$"]'));

      return {
        foundGrid: true,
        gridText: grid.innerText.substring(0, 1000),
        pageLinks: pageLinks.map(a => ({
          text: a.innerText.trim(),
          href: a.getAttribute('href')
        }))
      };
    });

    console.log("CPSA Pagination Info:", paginationInfo);

  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
}

testCPSAPagination();
