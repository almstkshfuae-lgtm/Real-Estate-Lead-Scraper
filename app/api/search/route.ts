import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession, getSessionWithDBVerify } from "@/lib/auth";
import { safeParseJson } from "@/lib/safe-fetch";

export async function POST(request: Request) {
  try {
    const session = await getSessionWithDBVerify();

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
    const session = await getSession();

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
      criteria: safeParseJson(search.criteria, {}, 'search.criteria'),
    }));

    return NextResponse.json(parsedSearches);
  } catch (error) {
    console.error("Search fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionWithDBVerify();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.search.deleteMany({
      where: {
        id,
        agentId: session.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Search delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

