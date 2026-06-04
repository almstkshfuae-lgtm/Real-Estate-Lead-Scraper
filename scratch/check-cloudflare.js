import { chromium } from 'playwright';
const CLOUDFLARE_INDICATORS = [
    'cf_challenge',
    'cf_clearance',
    '__cf_bm',
    'managed_rules',
    'Access Denied',
    'Ray ID',
    'Something went wrong'
];
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
    try {
        await page.goto('https://www.adgm.com', { timeout: 30000, waitUntil: 'domcontentloaded' });
        const html = await page.content();
        console.log("URL:", page.url());
        for (const indicator of CLOUDFLARE_INDICATORS) {
            if (html.includes(indicator)) {
                console.log(`MATCHED CLOUDFLARE INDICATOR: "${indicator}"`);
                // Find index of match to see context
                const index = html.indexOf(indicator);
                console.log("Snippet around match:", html.substring(Math.max(0, index - 50), index + 100));
            }
        }
    }
    catch (err) {
        console.error("Error:", err.message);
    }
    finally {
        await browser.close();
    }
}
main();
