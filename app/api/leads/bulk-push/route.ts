import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, parsePreferences } from "@/lib/auth";
import { pushContact, testConnection } from "@/lib/bitrix24";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    // 1. Get Bitrix settings from User preferences
    const user = await prisma.user.findUnique({
      where: { id: session.id },
    });

    const prefs = parsePreferences((user as any)?.preferences).integrations || {};
    const { bitrixDomain, bitrixToken } = prefs;

    if (!bitrixDomain || !bitrixToken) {
      return NextResponse.json({ 
        error: "Bitrix24 not configured. Please go to Settings > Integrations." 
      }, { status: 400 });
    }

    // Pre-flight session validation: Check connection before processing the bulk batch
    const isConnectionValid = await testConnection(bitrixDomain, bitrixToken);
    if (!isConnectionValid) {
      return NextResponse.json({ 
        error: "Bitrix24 session is invalid or expired. Please check your credentials in Settings > Integrations." 
      }, { status: 401 });
    }

    // 2. Get the leads
    const leads = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        agentId: session.id // Ensure agents only push their own leads
      }
    });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // 3. Push to Bitrix24 sequentially (or in small batches) with transactional breaks
    for (const lead of leads) {
      try {
        const bitrixId = await pushContact(bitrixDomain, bitrixToken, lead);
        
        // Update lead with Bitrix ID
        await prisma.lead.update({
          where: { id: lead.id },
          data: { bitrix24Id: String(bitrixId) }
        });
        
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Lead ${lead.name}: ${error.message}`);

        // If it's a token authorization/expired error, abort subsequent loop items to prevent partial pipeline sync issues
        const isAuthError = 
          error.message?.toLowerCase().includes("unauthorized") || 
          error.message?.toLowerCase().includes("401") || 
          error.message?.toLowerCase().includes("expired") ||
          error.message?.toLowerCase().includes("invalid_token");
          
        if (isAuthError) {
          results.errors.push("Bulk push loop aborted mid-way due to active Bitrix24 token expiration.");
          break; // Break loop immediately
        }
      }
    }

    return NextResponse.json({ 
      success: results.failed === 0,
      count: results.success,
      failed: results.failed,
      errors: results.errors
    });

  } catch (error: any) {
    console.error("Bulk Bitrix push error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
