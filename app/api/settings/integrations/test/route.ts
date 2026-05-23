import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { testConnection } from "@/lib/bitrix24";
import { testMailConnection } from "@/lib/mail";
import { testWhatsAppConnection } from "@/lib/whatsapp";
import { getEnvVar } from "@/lib/env";
import { ScraperClient } from "@/lib/scraper-client";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { system, config } = await request.json();

    if (system === 'scraper') {
      const scraperServiceUrl = config.scraperServiceUrl || getEnvVar('SCRAPER_SERVICE_URL');
      const scraperSecret = config.scraperSecret || getEnvVar('SCRAPER_SECRET');
      const proxyServiceUrl = config.proxyServiceUrl || getEnvVar('PROXY_SERVICE_URL');
      const proxyApiKey = config.proxyApiKey || getEnvVar('PROXY_API_KEY');

      if (!scraperServiceUrl) {
        return NextResponse.json({ success: false, error: 'Scraper service URL is required' }, { status: 400 });
      }

      const client = new ScraperClient({
        baseUrl: scraperServiceUrl,
        secret: scraperSecret || '',
        proxyUrl: proxyServiceUrl || undefined,
        proxyApiKey: proxyApiKey || undefined
      });

      const success = await client.testConnection();
      return NextResponse.json({ success });
    }

    if (system === 'bitrix') {
      const { bitrixDomain, bitrixToken } = config;
      const success = await testConnection(bitrixDomain, bitrixToken);
      return NextResponse.json({ success });
    }

    if (system === 'whatsapp') {
      const { whatsappPhoneId, whatsappToken } = config;
      const success = await testWhatsAppConnection(whatsappPhoneId, whatsappToken);
      return NextResponse.json({ success });
    }

    if (system === 'smtp') {
      const { smtpHost, smtpUser, smtpPass } = config;
      const success = await testMailConnection(smtpHost, 587, false, smtpUser, smtpPass);
      return NextResponse.json({ success });
    }

    // Add other systems here later (WhatsApp, SMTP)
    return NextResponse.json({ success: false, error: "System not supported yet" });

  } catch (error: any) {
    console.error("Test connection error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
