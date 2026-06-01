import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const markRead = searchParams.get("markRead") === "true";

    const notifications = await prisma.notification.findMany({
      where: { agentId: session.id, read: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (markRead && notifications.length > 0) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notifications.map((notification) => notification.id) },
        },
        data: { read: true },
      });
    }

    return NextResponse.json({ notifications, count: notifications.length }, { status: 200 });
  } catch (error: any) {
    console.error("Notifications fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
