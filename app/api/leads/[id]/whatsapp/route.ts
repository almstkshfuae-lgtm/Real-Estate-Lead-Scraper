import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, parsePreferences } from "@/lib/auth";
import { sendWhatsAppText } from "@/lib/whatsapp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    // 1. Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead || !lead.phone) {
      return NextResponse.json({ error: "Lead or phone number not found" }, { status: 404 });
    }

    // 2. Get WhatsApp settings from User preferences
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const prefs = parsePreferences((user as any)?.preferences).integrations || {};
    const { whatsappPhoneId, whatsappToken } = prefs;

    if (!whatsappPhoneId || !whatsappToken) {
      return NextResponse.json({ 
        error: "WhatsApp not configured. Please go to Settings > Integrations." 
      }, { status: 400 });
    }

    // 3. Send WhatsApp message
    // Note: Simple text messages only work if there's an active 24h window.
    // In a real production app, you'd use templates first.
    await sendWhatsAppText(whatsappPhoneId, whatsappToken, lead.phone, text);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("WhatsApp send error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
