import { loadEnvConfig } from '@next/env';
async function main() {
    const { combinedEnv } = loadEnvConfig(process.cwd());
    console.log("Combined Env SCRAPER_SECRET:", combinedEnv.SCRAPER_SECRET);
    console.log("process.env.SCRAPER_SECRET:", process.env.SCRAPER_SECRET);
}
main().catch(console.error);
