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
    const conditions: any[] = [];
    
    // Agents can only see their own leads, Admins see all
    // Use case-insensitive comparison for role
    if (session.role?.toUpperCase() !== 'ADMIN') {
      conditions.push({ agentId: session.id });
    }

    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search } },
          { company: { contains: search } },
        ]
      });
    }

    if (status) {
      conditions.push({ status });
    }
    
    if (tier) {
      const parsedTier = parseInt(tier);
      if (!isNaN(parsedTier)) {
        conditions.push({ tier: parsedTier });
      }
    }

    if (scrapeRunId) {
      conditions.push({ scrapeRunId });
    }

    const scoreMin = searchParams.get("scoreMin") || "";
    if (scoreMin) {
      const parsedScoreMin = parseInt(scoreMin);
      if (!isNaN(parsedScoreMin)) {
        conditions.push({ score: { gte: parsedScoreMin } });
      }
    }

    const northParam = searchParams.get("north");
    const southParam = searchParams.get("south");
    const eastParam = searchParams.get("east");
    const westParam = searchParams.get("west");

    if (northParam && southParam && eastParam && westParam) {
      const north = parseFloat(northParam);
      const south = parseFloat(southParam);
      const east = parseFloat(eastParam);
      const west = parseFloat(westParam);
      
      if (!isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west)) {
        conditions.push({
          latitude: {
            gte: south,
            lte: north,
          }
        });
        
        if (west <= east) {
          conditions.push({
            longitude: {
              gte: west,
              lte: east,
            }
          });
        } else {
          conditions.push({
            OR: [
              { longitude: { gte: west } },
              { longitude: { lte: east } }
            ]
          });
        }
      }
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });
    const total = await prisma.lead.count({ where });

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
