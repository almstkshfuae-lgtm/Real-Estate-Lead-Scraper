import { PrismaClient } from '@prisma/client';
import { DEFAULT_SCRAPER_SOURCES } from '../scraper-service/default-sources.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Syncing default sources to Database...");
  for (const source of DEFAULT_SCRAPER_SOURCES) {
    console.log(`Syncing source: ${source.key}...`);
    await prisma.sourceConfig.upsert({
      where: { key: source.key },
      update: {
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: source.navigationSelectors,
        contentSelectors: source.contentSelectors,
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: source.active !== undefined ? source.active : true
      },
      create: {
        key: source.key,
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: source.navigationSelectors,
        contentSelectors: source.contentSelectors,
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: source.active !== undefined ? source.active : true
      }
    });
  }
  console.log("Sync complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
