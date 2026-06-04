import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, parsePreferences } from "@/lib/auth";
import { sendEmail } from "@/lib/mail";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { subject, body } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
    }

    // 1. Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead || !lead.email) {
      return NextResponse.json({ error: "Lead or email address not found" }, { status: 404 });
    }

    // Cross-Tenant Access control: Only the owner (agentId) or an admin can access/action this lead
    if (session.role.toUpperCase() !== "ADMIN" && lead.agentId !== session.id) {
      return NextResponse.json({ error: "Unauthorized access to lead data" }, { status: 403 });
    }

    // 2. Get SMTP settings from User preferences
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = parsePreferences((user as any).preferences);
    const prefs = preferences.integrations || {};
    const { smtpHost, smtpUser, smtpPass } = prefs;

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({ 
        error: "SMTP not configured. Please go to Settings > Integrations." 
      }, { status: 400 });
    }

    // 3. Send Email
    await sendEmail({
      host: smtpHost,
      port: 587, // Standard SMTP port
      secure: false, // TLS
      user: smtpUser,
      pass: smtpPass,
      from: `"${user.name}" <${smtpUser}>`,
      to: lead.email,
      subject,
      text: body
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Email send error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
