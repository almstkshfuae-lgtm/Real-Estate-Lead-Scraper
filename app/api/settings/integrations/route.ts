import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, parsePreferences, normalizePreferences } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
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
      proxyApiKey: ""
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
    const integrations = {
      ...defaultPrefs,
      ...savedIntegrations,
      googleAiApiKey: savedIntegrations.googleAiApiKey || ""
    };

    return NextResponse.json({ integrations }, { status: 200 });

  } catch (error: any) {
    console.error("Fetch integrations error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrations } = await request.json();

    const currentUser = await prisma.user.findUnique({
      where: { id: session.id }
    });

    const existingPrefs = parsePreferences((currentUser as any)?.preferences);
    const newPrefs = { ...existingPrefs, integrations };

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
