import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, parsePreferences, normalizePreferences } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

export async function GET(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session || session.role.toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const defaultPrefs = {
      bitrixDomain: "",
      bitrixToken: "",
      bitrixPushMode: "contacts",
      whatsappPhoneId: "",
      whatsappToken: "",
      smtpHost: "",
      smtpUser: "",
      smtpPass: "",
      googleAiApiKey: "",
      scraperServiceUrl: "",
      scraperSecret: "",
      proxyServiceUrl: "",
      proxyApiKey: "",
      uaeComplianceMode: false,
      globalRateLimitDelay: 3000
    };

    let prefs: any = {};
    if (user && (user as any).preferences) {
      if (typeof (user as any).preferences === 'string') {
        try { prefs = JSON.parse((user as any).preferences); } catch (e) {}
      } else {
        prefs = (user as any).preferences;
      }
    }
    
    const savedIntegrations = prefs.integrations || {};

    // Helper to mask configured credentials
    const maskField = (val: string) => {
      return (val && val.trim() !== "") ? "********" : "";
    };

    const integrations = {
      ...defaultPrefs,
      ...savedIntegrations,
      googleAiApiKey: maskField(savedIntegrations.googleAiApiKey),
      bitrixToken: maskField(savedIntegrations.bitrixToken),
      whatsappToken: maskField(savedIntegrations.whatsappToken),
      smtpPass: maskField(savedIntegrations.smtpPass)
    };

    return NextResponse.json({ integrations }, { status: 200 });

  } catch (error: any) {
    console.error("Fetch integrations error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session || session.role.toUpperCase() !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrations } = await request.json();

    const currentUser = await prisma.user.findUnique({
      where: { id: session.id }
    });

    const existingPrefs = parsePreferences((currentUser as any)?.preferences);
    const existingIntegrations = existingPrefs.integrations || {};

    // Encrypt new plaintext values; preserve existing encrypted values if masked with stars
    const processField = (newVal: string, oldVal: string) => {
      const trimmed = (newVal || "").trim();
      if (trimmed === "" || trimmed.startsWith("***")) {
        if (trimmed.startsWith("***")) {
          return oldVal || "";
        }
        return "";
      }
      return encrypt(trimmed);
    };

    const googleAiApiKey = processField(integrations.googleAiApiKey, existingIntegrations.googleAiApiKey);
    const bitrixToken = processField(integrations.bitrixToken, existingIntegrations.bitrixToken);
    const whatsappToken = processField(integrations.whatsappToken, existingIntegrations.whatsappToken);
    const smtpPass = processField(integrations.smtpPass, existingIntegrations.smtpPass);

    const updatedIntegrations = {
      ...integrations,
      googleAiApiKey,
      bitrixToken,
      whatsappToken,
      smtpPass
    };

    const newPrefs = { ...existingPrefs, integrations: updatedIntegrations };

    await prisma.user.update({
      where: { id: session.id },
      data: { preferences: normalizePreferences(newPrefs) }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Update integrations error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

