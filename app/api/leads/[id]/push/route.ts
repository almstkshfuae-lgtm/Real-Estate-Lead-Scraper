import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, parsePreferences, isAdmin } from "@/lib/auth";
import { pushContact, pushDeal } from "@/lib/bitrix24";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let lead: any = null;
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 1. Get the lead
    lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Cross-Tenant Access control: Only the owner (agentId) or an admin can access/action this lead
    if (!isAdmin(session.role) && lead.agentId !== session.id) {
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

    // 4. Update lead with Bitrix Contact ID and success metadata
    const currentMetadata = (lead.metadata as Record<string, any>) || {};
    await prisma.lead.update({
      where: { id },
      data: {
        bitrix24Id: String(bitrixContactId),
        metadata: {
          ...currentMetadata,
          bitrixSyncStatus: "SUCCESS",
          bitrixSyncError: null,
          bitrixSyncUpdatedAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      bitrixContactId,
      bitrixDealId 
    });

  } catch (error: any) {
    console.error("Bitrix push error:", error);
    try {
      if (lead) {
        const currentMetadata = (lead.metadata as Record<string, any>) || {};
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
            metadata: {
              ...currentMetadata,
              bitrixSyncStatus: "FAILED",
              bitrixSyncError: error.message || String(error),
              bitrixSyncUpdatedAt: new Date().toISOString()
            }
          }
        });

        // Notify admins
        const allUsers = await prisma.user.findMany();
        const admins = allUsers.filter(u => isAdmin(u.role));
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              agentId: admin.id,
              title: `CRM Push Failed`,
              body: `Failed to push lead "${lead.name}" (${lead.company}) to Bitrix24: ${error.message || String(error)}`,
              type: "error",
              data: JSON.stringify({ leadId: lead.id, error: error.message || String(error) })
            }
          });
        }
      }
    } catch (dbErr) {
      console.error("Failed to update failure metadata/notification in push route:", dbErr);
    }
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
