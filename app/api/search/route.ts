import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const session = token ? await verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { criteria } = body;

    const search = await prisma.search.create({
      data: {
        agentId: session.id,
        criteria: JSON.stringify(criteria || {}),
      },
    });

    return NextResponse.json(search);
  } catch (error) {
    console.error("Search save error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    const session = token ? await verifyToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searches = await prisma.search.findMany({
      where: { agentId: session.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const parsedSearches = searches.map((search) => ({
      ...search,
      criteria: typeof search.criteria === 'string'
        ? JSON.parse(search.criteria)
        : search.criteria,
    }));

    return NextResponse.json(parsedSearches);
  } catch (error) {
    console.error("Search fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
