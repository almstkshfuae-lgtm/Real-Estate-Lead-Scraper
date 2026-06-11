import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
    }

    // Fetch only active leads that belong to the current user (unless admin)
    // Exclude already-soft-deleted records to prevent redundant writes and audit noise
    const isNonAdmin = !['ADMIN', 'SUPER ADMIN', 'SUPER_ADMIN', 'SUPERADMIN'].includes(session.role?.toUpperCase() || '');

    const leadsToDelete = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(isNonAdmin && { agentId: session.id })
      },
      select: { id: true, name: true, company: true }
    });

    const deleteResult = await prisma.lead.updateMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(isNonAdmin && { agentId: session.id })
      },
      data: {
        deletedAt: new Date()
      }
    });

    if (leadsToDelete.length > 0) {
      try {
        await prisma.auditLog.createMany({
          data: leadsToDelete.map(lead => ({
            action: "SOFT_DELETE",
            entityType: "Lead",
            entityId: lead.id,
            agentId: session.id,
            details: `Bulk soft deleted lead: ${lead.name} (${lead.company})`
          }))
        });
      } catch (auditErr) {
        console.error("Failed to create bulk delete audit logs:", auditErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      count: deleteResult.count 
    });

  } catch (error: any) {
    console.error("Bulk lead delete error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
