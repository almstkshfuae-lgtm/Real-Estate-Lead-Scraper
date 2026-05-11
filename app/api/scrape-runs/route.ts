import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const runs = await prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    return NextResponse.json({ runs });
  } catch (error: any) {
    console.error("Fetch ScrapeRuns Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
