import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isHostAdmin = session.role.toUpperCase() === 'ADMIN';
    const runs = await prisma.scrapeRun.findMany({
      where: isHostAdmin ? {} : { triggeredBy: session.id },
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    console.error("Fetch ScrapeRuns Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
