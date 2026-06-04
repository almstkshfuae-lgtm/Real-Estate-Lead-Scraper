import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, parsePreferences } from "@/lib/auth";
import { pushContact, pushDeal } from "@/lib/bitrix24";

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
        error: "Bitrix24 push is currently disabled in Settings." 
      }, { status: 400 });
    }

    // 3. Push to Bitrix24
    // Always push contact first (or use existing if we had robust mapping, but for now we push new)
    const bitrixContactId = await pushContact(bitrixDomain, bitrixToken, lead);
    let bitrixDealId = null;

    // Optional: Push Deal if configured (UI value 'deals' means Contacts + Deals)
    if (bitrixPushMode === 'deals') {
      try {
        bitrixDealId = await pushDeal(bitrixDomain, bitrixToken, String(bitrixContactId), lead);
      } catch (dealError) {
        console.error("Deal push failed, but contact succeeded:", dealError);
        // We don't fail the whole request if deal fails but contact worked
      }
    }

    // 4. Update lead with Bitrix Contact ID
    await prisma.lead.update({
      where: { id },
      data: { bitrix24Id: String(bitrixContactId) }
    });

    return NextResponse.json({ 
      success: true, 
      bitrixContactId,
      bitrixDealId 
    });

  } catch (error: any) {
    console.error("Bitrix push error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
