import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { preferences: true }
    });

    const defaultPrefs = {
      bitrixDomain: "",
      bitrixToken: "",
      bitrixPushMode: "contacts",
      whatsappPhoneId: "",
      whatsappToken: "",
      smtpHost: "",
      smtpUser: "",
      smtpPass: ""
    };

    let prefs: any = {};
    if (user && user.preferences) {
      if (typeof user.preferences === 'string') {
        try { prefs = JSON.parse(user.preferences); } catch (e) {}
      } else {
        prefs = user.preferences;
      }
    }
    
    const integrations = prefs.integrations || defaultPrefs;

    return NextResponse.json({ integrations }, { status: 200 });

  } catch (error) {
    console.error("Fetch integrations error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { integrations } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { preferences: true }
    });

    const newPrefs = { ...(user?.preferences as any || {}), integrations };

    await prisma.user.update({
      where: { id: session.id },
      data: { preferences: newPrefs }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Update integrations error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
