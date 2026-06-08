import { getWebhookUrl } from "../lib/scraper-client";
// Setup mock env variables
function runTests() {
    console.log("Running Webhook URL resolution tests...\n");
    const testCases = [
        {
            name: "Standard localhost http",
            origin: "http://localhost:3000",
            env: {},
            expected: "http://127.0.0.1:3000/api/scrape/webhook"
        },
        {
            name: "Standard localhost https",
            origin: "https://localhost:3000",
            env: {},
            expected: "https://127.0.0.1:3000/api/scrape/webhook"
        },
        {
            name: "IPv6 [::1]",
            origin: "http://[::1]:3000",
            env: {},
            expected: "http://127.0.0.1:3000/api/scrape/webhook"
        },
        {
            name: "IPv6 loopback ::1 without brackets (malformed/custom)",
            origin: "http://::1:3000",
            env: {},
            expected: "http://127.0.0.1:3000/api/scrape/webhook"
        },
        {
            name: "Production Vercel URL",
            origin: "https://real-estate-lead-scraper.vercel.app",
            env: {},
            expected: "https://real-estate-lead-scraper.vercel.app/api/scrape/webhook"
        },
        {
            name: "APP_URL override",
            origin: "http://localhost:3000",
            env: { APP_URL: "https://my-custom-dev-domain.com" },
            expected: "https://my-custom-dev-domain.com/api/scrape/webhook"
        },
        {
            name: "NEXT_PUBLIC_APP_URL override",
            origin: "http://localhost:3000",
            env: { NEXT_PUBLIC_APP_URL: "http://192.168.1.100:3001" },
            expected: "http://192.168.1.100:3001/api/scrape/webhook"
        },
        {
            name: "WEBHOOK_URL full path override",
            origin: "http://localhost:3000",
            env: { WEBHOOK_URL: "https://tunnel.ngrok-free.app/api/scrape/webhook" },
            expected: "https://tunnel.ngrok-free.app/api/scrape/webhook"
        },
        {
            name: "WEBHOOK_URL base override",
            origin: "http://localhost:3000",
            env: { WEBHOOK_URL: "https://tunnel.ngrok-free.app" },
            expected: "https://tunnel.ngrok-free.app/api/scrape/webhook"
        },
        {
            name: "WEBHOOK_URL base override trailing slash",
            origin: "http://localhost:3000",
            env: { WEBHOOK_URL: "https://tunnel.ngrok-free.app/" },
            expected: "https://tunnel.ngrok-free.app/api/scrape/webhook"
        }
    ];
    let failed = 0;
    for (const tc of testCases) {
        // Save original env
        const originalWebhookUrl = process.env.WEBHOOK_URL;
        const originalAppUrl = process.env.APP_URL;
        const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;
        // Apply test env
        if (tc.env.WEBHOOK_URL !== undefined)
            process.env.WEBHOOK_URL = tc.env.WEBHOOK_URL;
        else
            delete process.env.WEBHOOK_URL;
        if (tc.env.APP_URL !== undefined)
            process.env.APP_URL = tc.env.APP_URL;
        else
            delete process.env.APP_URL;
        if (tc.env.NEXT_PUBLIC_APP_URL !== undefined)
            process.env.NEXT_PUBLIC_APP_URL = tc.env.NEXT_PUBLIC_APP_URL;
        else
            delete process.env.NEXT_PUBLIC_APP_URL;
        const actual = getWebhookUrl(tc.origin);
        const passed = actual === tc.expected;
        console.log(`${passed ? "✅" : "❌"} [${tc.name}]`);
        console.log(`   Origin: ${tc.origin}`);
        console.log(`   Env:    ${JSON.stringify(tc.env)}`);
        console.log(`   Actual: ${actual}`);
        console.log(`   Expect: ${tc.expected}\n`);
        if (!passed) {
            failed++;
        }
        // Restore env
        if (originalWebhookUrl !== undefined)
            process.env.WEBHOOK_URL = originalWebhookUrl;
        else
            delete process.env.WEBHOOK_URL;
        if (originalAppUrl !== undefined)
            process.env.APP_URL = originalAppUrl;
        else
            delete process.env.APP_URL;
        if (originalNextPublicAppUrl !== undefined)
            process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
        else
            delete process.env.NEXT_PUBLIC_APP_URL;
    }
    if (failed > 0) {
        console.log(`Test suite failed: ${failed} tests failed.`);
        process.exit(1);
    }
    else {
        console.log("All tests passed successfully!");
    }
}
runTests();
