import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, parsePreferences } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/mail";

export const maxDuration = 60; // Allow up to 60s for bulk requests

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { leadIds, channel, templateText } = body;

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    if (!templateText) {
      return NextResponse.json({ error: "Template text is required" }, { status: 400 });
    }

    if (channel !== "whatsapp" && channel !== "email") {
      return NextResponse.json({ error: "Invalid outreach channel" }, { status: 400 });
    }

    // 1. Get user integration settings
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const preferences = parsePreferences(user.preferences);
    const prefs = preferences.integrations || {};

    let whatsappPhoneId = "";
    let decryptedWhatsappToken = "";
    let smtpHost = "";
    let smtpUser = "";
    let decryptedSmtpPass = "";

    if (channel === "whatsapp") {
      whatsappPhoneId = prefs.whatsappPhoneId;
      const whatsappToken = prefs.whatsappToken;
      if (!whatsappPhoneId || !whatsappToken) {
        return NextResponse.json({
          error: "WhatsApp is not configured. Please go to Settings > Integrations."
        }, { status: 400 });
      }
      decryptedWhatsappToken = decrypt(whatsappToken);
    } else {
      smtpHost = prefs.smtpHost;
      smtpUser = prefs.smtpUser;
      const smtpPass = prefs.smtpPass;
      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({
          error: "SMTP Email is not configured. Please go to Settings > Integrations."
        }, { status: 400 });
      }
      decryptedSmtpPass = decrypt(smtpPass);
    }

    // 2. Query the target leads — exclude soft-deleted records
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: leadIds },
        deletedAt: null,
      },
    });

    const results = {
      success: 0,
      failed: 0,
      details: [] as any[]
    };

    // 3. Sequential rate-limited loop
    for (const lead of leads) {
      // Access Control check
      if (session.role.toUpperCase() !== "ADMIN" && lead.agentId !== session.id) {
        results.failed++;
        results.details.push({
          leadId: lead.id,
          name: lead.name,
          success: false,
          error: "Unauthorized access to lead data"
        });
        continue;
      }

      // Check contact channel presence
      if (channel === "whatsapp" && !lead.phone) {
        results.failed++;
        results.details.push({
          leadId: lead.id,
          name: lead.name,
          success: false,
          error: "Lead has no phone number"
        });
        continue;
      }

      if (channel === "email" && !lead.email) {
        results.failed++;
        results.details.push({
          leadId: lead.id,
          name: lead.name,
          success: false,
          error: "Lead has no email address"
        });
        continue;
      }

      // Interpolate placeholders
      let message = templateText
        .replace(/{{name}}/g, lead.name || "")
        .replace(/{{company}}/g, lead.company || "")
        .replace(/{{location}}/g, lead.location || "");

      try {
        if (channel === "whatsapp") {
          await sendWhatsAppText(whatsappPhoneId, decryptedWhatsappToken, lead.phone!, message);
        } else {
          await sendEmail({
            host: smtpHost,
            port: 587,
            secure: false,
            user: smtpUser,
            pass: decryptedSmtpPass,
            from: `"${user.name}" <${smtpUser}>`,
            to: lead.email!,
            subject: `Exclusive Real Estate Opportunity: ${lead.company}`,
            text: message
          });
        }

        // Success updates
        const updatedNotes = lead.notes 
          ? `${lead.notes}\n\n[Outreach Campaign - ${channel.toUpperCase()}] ${new Date().toISOString()}:\n${message}`
          : `[Outreach Campaign - ${channel.toUpperCase()}] ${new Date().toISOString()}:\n${message}`;

        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            status: "contacted",
            notes: updatedNotes
          }
        });

        // Audit Log
        await prisma.auditLog.create({
          data: {
            action: "UPDATE",
            entityType: "Lead",
            entityId: lead.id,
            agentId: session.id,
            details: `Campaign outreach sent successfully via ${channel}`
          }
        });

        results.success++;
        results.details.push({
          leadId: lead.id,
          name: lead.name,
          success: true
        });

        // Small delay to respect rate limits and prevent spam flags
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`Outreach failed for lead ${lead.id}:`, error);
        results.failed++;
        results.details.push({
          leadId: lead.id,
          name: lead.name,
          success: false,
          error: error.message || "Sending failed"
        });
      }
    }

    return NextResponse.json({
      success: results.failed === 0,
      successCount: results.success,
      failCount: results.failed,
      details: results.details
    });

  } catch (error: any) {
    console.error("[Campaign Outreach API Error]", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
