import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import { buildSearchConditions } from "@/lib/search";
import { getAreasInBounds } from "@/lib/areas";


export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const tier = searchParams.get("tier") || "";
    const scoreMin = searchParams.get("scoreMin") || "";
    const limitParam = searchParams.get("limit") || "1000";

    const parsedLimit = parseInt(limitParam);
    const limit = isNaN(parsedLimit) ? 1000 : Math.min(2000, Math.max(1, parsedLimit));

    const where: any = {};
    const conditions: any[] = [];

    // Enforce data access control: non-admins only see their own leads
    if (!isAdmin(session.role)) {
      conditions.push({ agentId: session.id });
    }

    // Exclude soft deleted leads
    conditions.push({ deletedAt: null });

    if (search) {
      const searchFields = ["name", "nameAr", "company", "companyAr", "location"];
      conditions.push(...buildSearchConditions(search, searchFields));
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

    if (scoreMin) {
      const parsedScoreMin = parseInt(scoreMin);
      if (!isNaN(parsedScoreMin)) {
        conditions.push({ score: { gte: parsedScoreMin } });
      }
    }

    // Retrieve location text parameter as fallback
    const locationParam = searchParams.get("location") || searchParams.get("locationText") || searchParams.get("city") || searchParams.get("area") || "";

    const northParam = searchParams.get("north");
    const southParam = searchParams.get("south");
    const eastParam = searchParams.get("east");
    const westParam = searchParams.get("west");

    let hasGeofence = false;

    if (northParam && southParam && eastParam && westParam) {
      const north = parseFloat(northParam);
      const south = parseFloat(southParam);
      const east = parseFloat(eastParam);
      const west = parseFloat(westParam);

      if (!isNaN(north) && !isNaN(south) && !isNaN(east) && !isNaN(west)) {
        hasGeofence = true;

        const coordConditions: any[] = [];
        coordConditions.push({
          latitude: {
            gte: south,
            lte: north,
          }
        });

        if (west <= east) {
          coordConditions.push({
            longitude: {
              gte: west,
              lte: east,
            }
          });
        } else {
          coordConditions.push({
            OR: [
              { longitude: { gte: west } },
              { longitude: { lte: east } }
            ]
          });
        }

        // Add fallback to text matching for leads without precise coordinates
        const geoOrConditions: any[] = [{ AND: coordConditions }];
        const areasInBounds = getAreasInBounds(north, south, east, west);

        if (areasInBounds.length > 0) {
          const textMatches = areasInBounds.flatMap(areaName => [
            { location: { contains: areaName } },
            { locationAr: { contains: areaName } }
          ]);
          geoOrConditions.push({
            AND: [
              { OR: [{ latitude: null }, { longitude: null }] },
              { OR: textMatches }
            ]
          });
        }

        conditions.push({ OR: geoOrConditions });
      }
    }

    // Fallback: If no geofence filter was applied but a location parameter was provided
    if (!hasGeofence && locationParam) {
      conditions.push({
        OR: buildSearchConditions(locationParam, ["location", "locationAr"])
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    // Retrieve leads for mapping (only return required fields for performance)
    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameAr: true,
        company: true,
        companyAr: true,
        role: true,
        roleAr: true,
        source: true,
        sourceType: true,
        tier: true,
        phone: true,
        email: true,
        location: true,
        score: true,
        budgetMin: true,
        budgetMax: true,
        latitude: true,
        longitude: true,
        relocated: true,
        rentalFlag: true,
        status: true,
        notes: true,
        createdAt: true,
        signals: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Parse JSON signals and property preferences properly
    const formattedLeads = leads.map((lead: any) => {
      let parsedSignals: string[] = [];
      try {
        if (typeof lead.signals === "string") {
          if (lead.signals.trim().startsWith("[")) {
            parsedSignals = JSON.parse(lead.signals);
          } else if (lead.signals.trim() !== "") {
            parsedSignals = lead.signals.split(",").map((s: string) => s.trim());
          }
        } else if (Array.isArray(lead.signals)) {
          parsedSignals = lead.signals;
        } else if (lead.signals && typeof lead.signals === "object") {
          parsedSignals = Object.values(lead.signals);
        }
      } catch (e) {
        if (typeof lead.signals === "string") {
          parsedSignals = lead.signals.split(",").map((s: string) => s.trim());
        }
      }

      return {
        ...lead,
        signals: Array.isArray(parsedSignals) ? parsedSignals : [],
      };
    });

    return NextResponse.json({ leads: formattedLeads });
  } catch (error: any) {
    console.error("Leads cluster API error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    );
  }
}
