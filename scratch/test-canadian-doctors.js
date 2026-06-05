import { chromium } from 'playwright';

async function findSelectors() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.canadiandoctorsdirectory.com/ontario/toronto/', { waitUntil: 'domcontentloaded' });

  const links = await page.evaluate(() => {
    // Find links that do not contain 'page/', 'specialty', 'clinic', 'blog', 'add-a-doctor', etc.
    const anchors = Array.from(document.querySelectorAll('a'));
    return anchors
      .map(a => {
        // Build a CSS selector for this element
        let path = [];
        let el = a;
        while (el && el.nodeType === Node.ELEMENT_NODE) {
          let selector = el.nodeName.toLowerCase();
          if (el.className) {
            selector += '.' + el.className.trim().replace(/\s+/g, '.');
          }
          path.unshift(selector);
          el = el.parentNode;
        }
        return {
          text: a.innerText.trim(),
          href: a.getAttribute('href'),
          selector: path.join(' > ')
        };
      })
      .filter(l => l.href && !l.href.includes('page/') && !l.href.includes('specialty') && !l.href.includes('clinic') && !l.href.includes('blog') && !l.href.includes('add-a-doctor') && l.text.split('\n')[0].length > 2 && l.text.includes('views'));
  });

  console.log("Filtered links and their CSS paths:", links.slice(0, 10));
  await browser.close();
}

findSelectors();
