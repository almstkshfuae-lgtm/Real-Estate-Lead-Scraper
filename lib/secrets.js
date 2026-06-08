import prisma from "./prisma";
import { getEnvVar } from "./env";
export async function getSecret(keyName) {
    var _a;
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
        if (admin && admin.preferences) {
            const prefs = typeof admin.preferences === 'string'
                ? JSON.parse(admin.preferences)
                : admin.preferences;
            const val = (_a = prefs.integrations) === null || _a === void 0 ? void 0 : _a[keyName];
            if (val && val.trim() !== "" && !val.includes("****")) {
                return val;
            }
        }
    }
    catch (err) {
        console.error(`Error fetching secret ${keyName} from DB:`, err);
    }
    // 2. Fallback to Environment Variables
    const envMap = {
        googleAiApiKey: getEnvVar('GOOGLE_AI_API_KEY') || getEnvVar('GOOGLE_API_KEY'),
        scraperServiceUrl: getEnvVar('SCRAPER_SERVICE_URL'),
        scraperSecret: getEnvVar('SCRAPER_SECRET'),
        proxyServiceUrl: getEnvVar('PROXY_SERVICE_URL'),
        proxyApiKey: getEnvVar('PROXY_API_KEY'),
        bitrixToken: getEnvVar('BITRIX24_TOKEN'),
        whatsappToken: getEnvVar('WHATSAPP_TOKEN'),
    };
    return envMap[keyName] || "";
}
