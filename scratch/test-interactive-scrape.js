import prisma from '../lib/prisma';
import { ScraperClient } from '../lib/scraper-client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
async function main() {
    console.log('=== Test Interactive Scrape Pipeline ===');
    // 1. Ensure a dummy agent user exists to assign leads
    let agent = await prisma.user.findFirst({ where: { role: 'agent' } });
    if (!agent) {
        agent = await prisma.user.findFirst({ where: { role: 'admin' } });
    }
    if (!agent) {
        console.log('Creating a dummy agent user...');
        agent = await prisma.user.create({
            data: {
                email: 'testagent@brilliance.ae',
                passwordHash: 'dummyhash',
                name: 'Test Agent',
                role: 'agent'
            }
        });
    }
    console.log(`Using Agent ID: ${agent.id}`);
    // 2. Create a ScrapeRun
    const scrapeRun = await prisma.scrapeRun.create({
        data: {
            triggeredBy: agent.id,
            sources: JSON.stringify(['google-maps', 'yellow-pages']),
            criteria: JSON.stringify({ emirates: ['Dubai'], signals: ['Real Estate Developer'] }),
            status: 'PENDING'
        }
    });
    console.log(`Created ScrapeRun ID: ${scrapeRun.id}`);
    // 3. Trigger Scrape
    try {
        const scraperClient = new ScraperClient({
            baseUrl: 'http://localhost:3002',
            secret: '96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684'
        });
        const webhookUrl = 'http://localhost:3001/api/scrape/webhook'; // Local webhook endpoint
        const sources = ['google-maps', 'yellow-pages'];
        const criteria = { emirates: ['Dubai'], signals: ['Real Estate'] };
        console.log(`Triggering scrape for sources: ${sources.join(', ')}...`);
        console.log(`With criteria: ${JSON.stringify(criteria)}`);
        const result = await scraperClient.scrapeMultipleSources(sources, webhookUrl, scrapeRun.id, criteria);
        console.log('Trigger Response:', JSON.stringify(result, null, 2));
        console.log('\nWait for webhook processing to complete. Check local server logs.');
    }
    catch (err) {
        console.error('Trigger Failed:', err.message || err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main().catch(console.error);
