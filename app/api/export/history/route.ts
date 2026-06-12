import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdmin(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = await prisma.exportHistory.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        agent: {
          select: { name: true, email: true }
        }
      }
    });

    return NextResponse.json({ history }, { status: 200 });

  } catch (error) {
    console.error("Fetch export history error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
