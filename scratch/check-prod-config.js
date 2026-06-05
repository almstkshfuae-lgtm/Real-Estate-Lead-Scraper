import { PrismaClient } from '@prisma/client';
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

async function checkConfig() {
  try {
    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "admin@brilliance-lead.uk" },
          { role: "admin" }
        ]
      }
    });

    console.log("Admin user found:", admin ? {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      hasPreferences: !!admin.preferences
    } : "null");

    if (admin && admin.preferences) {
      try {
        const prefs = JSON.parse(admin.preferences);
        console.log("Admin preferences keys:", Object.keys(prefs));
        if (prefs.integrations) {
          console.log("Admin integrations keys:", Object.keys(prefs.integrations));
          // Check if scraperSecret exists and is masked/real
          const sec = prefs.integrations.scraperSecret;
          console.log("scraperSecret:", sec ? `${sec.substring(0, 4)}... (length: ${sec.length})` : "undefined");
          const url = prefs.integrations.scraperServiceUrl;
          console.log("scraperServiceUrl:", url);
        }
      } catch (e) {
        console.error("Failed to parse preferences JSON:", e.message);
      }
    }

    // Check last 5 scrape runs
    const runs = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    console.log("Recent Scrape Runs:", runs);

  } catch (error) {
    console.error("DB check failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConfig();
