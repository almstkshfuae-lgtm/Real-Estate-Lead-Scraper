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

    // Delete leads that belong to the current user (unless admin)
    const deleteResult = await prisma.lead.deleteMany({
      where: {
        id: { in: ids },
        ...(session.role !== 'ADMIN' && { agentId: session.id })
      }
    });

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
