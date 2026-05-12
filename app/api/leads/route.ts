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
    
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    
    const parsedPage = pageParam ? parseInt(pageParam) : 1;
    const parsedLimit = limitParam ? parseInt(limitParam) : 50;
    
    const page = isNaN(parsedPage) ? 1 : Math.max(1, parsedPage);
    const limit = isNaN(parsedLimit) ? 50 : Math.min(100, Math.max(1, parsedLimit));
    
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const tier = searchParams.get("tier") || "";
    const scrapeRunId = searchParams.get("scrapeRunId") || "";

    const skip = (page - 1) * limit;

    const where: any = {};
    
    // Agents can only see their own leads, Admins see all
    // Use case-insensitive comparison for role
    if (session.role?.toUpperCase() !== 'ADMIN') {
      where.agentId = session.id;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { company: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }
    
    if (tier) {
      const parsedTier = parseInt(tier);
      if (!isNaN(parsedTier)) {
        where.tier = parsedTier;
      }
    }

    if (scrapeRunId) {
      where.scrapeRunId = scrapeRunId;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error("Leads fetch error:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined 
    }, { status: 500 });
  }
}
