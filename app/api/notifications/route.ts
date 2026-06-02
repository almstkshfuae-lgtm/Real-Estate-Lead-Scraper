import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Force dynamic rendering — notifications must never be cached by the CDN or Service Worker
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await prisma.notification.findMany({
      where: { agentId: session.id, read: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(
      { notifications, count: notifications.length },
      {
        status: 200,
        headers: {
          // Prevent CDN, browser, and Service Worker from caching notification responses.
          // Stale notifications would cause the polling loop to show ghost alerts.
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Body: { ids: string[] }
 * Marks specific notifications as read.
 * Decoupled from GET to avoid write operations under polling load.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json({ updated: 0 }, { status: 200 });
    }

    // Only mark notifications that belong to this user (prevent IDOR)
    const result = await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        agentId: session.id,
      },
      data: { read: true },
    });

    return NextResponse.json({ updated: result.count }, { status: 200 });
  } catch (error: any) {
    console.error("Notifications mark-read error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
