import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify, isAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids, status } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    if (!status || typeof status !== "string") {
      return NextResponse.json({ error: "No valid status provided" }, { status: 400 });
    }

    const trimmedStatus = status.trim();
    const isNonAdmin = !isAdmin(session.role);

    // Fetch leads to update first for audit log purposes and to verify ownership
    const leadsToUpdate = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(isNonAdmin && { agentId: session.id })
      },
      select: { id: true, name: true, company: true, status: true }
    });

    if (leadsToUpdate.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Perform bulk update in database
    const updateResult = await prisma.lead.updateMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(isNonAdmin && { agentId: session.id })
      },
      data: {
        status: trimmedStatus
      }
    });

    // Create Audit Logs for each updated lead
    try {
      await prisma.auditLog.createMany({
        data: leadsToUpdate.map(lead => ({
          action: "UPDATE",
          entityType: "Lead",
          entityId: lead.id,
          agentId: session.id,
          details: `Bulk updated status from "${lead.status}" to "${trimmedStatus}" for lead: ${lead.name} (${lead.company})`
        }))
      });
    } catch (auditErr) {
      console.error("Failed to create bulk update audit logs:", auditErr);
    }

    return NextResponse.json({
      success: true,
      count: updateResult.count
    });

  } catch (error: any) {
    console.error("Bulk lead update error:", error);
    return NextResponse.json({
      error: error.message || "Internal Server Error"
    }, { status: 500 });
  }
}
