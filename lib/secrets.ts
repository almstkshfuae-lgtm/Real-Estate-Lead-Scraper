import prisma from "./prisma";
import { getEnvVar } from "./env";
import { decrypt } from "./crypto";

export async function getSecret(keyName: string): Promise<string> {
  try {
    // 1. Try to get from Admin user preferences in DB (prioritizing admin@brilliance-lead.uk)
    const admin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: "admin@brilliance-lead.uk" },
          { role: "admin" }
        ]
      },
    });

    if (admin && (admin as any).preferences) {
      const prefs = typeof (admin as any).preferences === 'string' 
        ? JSON.parse((admin as any).preferences) 
        : (admin as any).preferences;
      
      const val = prefs.integrations?.[keyName];
      if (val && val.trim() !== "" && !val.includes("****")) {
        return decrypt(val);
      }
    }
  } catch (err) {
    console.error(`Error fetching secret ${keyName} from DB:`, err);
  }

  // 2. Fallback to Environment Variables
  const envMap: Record<string, string | undefined> = {
    googleAiApiKey:
      getEnvVar('GOOGLE_AI_API_KEY') || getEnvVar('GOOGLE_API_KEY'),
    scraperServiceUrl: getEnvVar('SCRAPER_SERVICE_URL'),
    scraperSecret: getEnvVar('SCRAPER_SECRET'),
    proxyServiceUrl: getEnvVar('PROXY_SERVICE_URL'),
    proxyApiKey: getEnvVar('PROXY_API_KEY'),
    bitrixToken: getEnvVar('BITRIX24_TOKEN'),
    whatsappToken: getEnvVar('WHATSAPP_TOKEN'),
  };

  return envMap[keyName] || "";
}

