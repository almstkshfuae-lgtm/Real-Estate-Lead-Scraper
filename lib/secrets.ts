import prisma from "./prisma";

export async function getSecret(keyName: string): Promise<string> {
  try {
    // 1. Try to get from Admin user preferences in DB
    const admin = await prisma.user.findFirst({
      where: { role: "admin" },
    });

    if (admin && (admin as any).preferences) {
      const prefs = typeof (admin as any).preferences === 'string' 
        ? JSON.parse((admin as any).preferences) 
        : (admin as any).preferences;
      
      const val = prefs.integrations?.[keyName];
      if (val && val.trim() !== "" && !val.includes("****")) {
        return val;
      }
    }
  } catch (err) {
    console.error(`Error fetching secret ${keyName} from DB:`, err);
  }

  // 2. Fallback to Environment Variables
  const envMap: Record<string, string | undefined> = {
    googleAiApiKey:
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY,
    apifyToken: process.env.APIFY_API_TOKEN,
    serpApiKey: process.env.SERPAPI_API_KEY,
    apolloApiKey: process.env.APOLLO_API_KEY,
    bitrixToken: process.env.BITRIX24_TOKEN,
    whatsappToken: process.env.WHATSAPP_TOKEN,
  };

  return envMap[keyName] || "";
}
