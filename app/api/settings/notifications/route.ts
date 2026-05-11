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
      emailAlerts: true,
      pushNotifications: false,
      newLeadAlerts: true,
      scrapeCompletion: true,
      weeklyDigest: false,
      whatsappAlerts: false
    };

    let prefs: any = {};
    if (user?.preferences) {
      if (typeof user.preferences === 'string') {
        try { prefs = JSON.parse(user.preferences); } catch { prefs = {}; }
      } else {
        prefs = user.preferences as any;
      }
    }

    const preferences = prefs.notifications ?? prefs.emailAlerts !== undefined ? prefs : defaultPrefs;

    return NextResponse.json({ preferences }, { status: 200 });

  } catch (error: any) {
    console.error("Fetch preferences error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error", detail: error?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { preferences } = await request.json();

    await prisma.user.update({
      where: { id: session.id },
      data: { preferences }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Update preferences error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
