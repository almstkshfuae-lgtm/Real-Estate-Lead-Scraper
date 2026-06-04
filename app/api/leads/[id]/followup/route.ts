import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, parsePreferences } from "@/lib/auth";
import { scheduleFollowUp } from "@/lib/bitrix24";

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
    const body = await request.json();
    const { title, description, startTime, endTime } = body;

    if (!startTime || !endTime) {
      return NextResponse.json({ error: "Missing required date fields" }, { status: 400 });
    }

    // 1. Get the lead
    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Cross-Tenant Access control: Only the owner (agentId) or an admin can access/action this lead
    if (session.role.toUpperCase() !== "ADMIN" && lead.agentId !== session.id) {
      return NextResponse.json({ error: "Unauthorized access to lead data" }, { status: 403 });
    }

    if (!lead.bitrix24Id) {
      return NextResponse.json({ 
        error: "Lead is not synced with Bitrix24. Please push to Bitrix24 first." 
      }, { status: 400 });
    }

    // 2. Get Bitrix settings from User preferences
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const prefs = parsePreferences((user as any)?.preferences).integrations || {};
    const { bitrixDomain, bitrixToken, bitrixPushMode } = prefs;

    if (!bitrixDomain || !bitrixToken) {
      return NextResponse.json({ 
        error: "Bitrix24 not configured. Please go to Settings > Integrations." 
      }, { status: 400 });
    }

    if (bitrixPushMode === 'off') {
      return NextResponse.json({ 
        error: "Bitrix24 integration is currently disabled in Settings." 
      }, { status: 400 });
    }

    // 3. Schedule follow-up in Bitrix24
    const activityId = await scheduleFollowUp(
      bitrixDomain, 
      bitrixToken, 
      lead.bitrix24Id, 
      {
        title,
        description,
        startTime,
        endTime
      }
    );

    return NextResponse.json({ 
      success: true, 
      activityId
    });

  } catch (error: any) {
    console.error("Bitrix follow-up error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
