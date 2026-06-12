import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildSearchConditions } from "@/lib/search";
import { getSession, isAdmin } from "@/lib/auth";
import { getAreasInBounds } from "@/lib/areas";


// Force dynamic rendering — leads must never be served from CDN cache
export const dynamic = "force-dynamic";

// Allow up to 30s — DB query + Railway connection can be slow on cold start
export const maxDuration = 30;

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
    // Use case-insensitive comparison for role supporting all admin variants
    if (!isAdmin(session.role)) {
      conditions.push({ agentId: session.id });
    }

    // Exclude soft deleted leads by default, unless includeDeleted is explicitly "true"
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    if (!includeDeleted) {
      conditions.push({ deletedAt: null });
    }

    if (search) {
      const searchFields = ["name", "nameAr", "company", "companyAr", "phone", "email", "location"];
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

    if (scrapeRunId) {
      conditions.push({ scrapeRunId });
    }

    const recentlyRelocatedParam = searchParams.get("recentlyRelocated") || searchParams.get("relocated");
    if (recentlyRelocatedParam === "true") {
      conditions.push({ relocated: true });
    }

    const excludeRentalParam = searchParams.get("excludeRental");
    if (excludeRentalParam === "true") {
      conditions.push({ rentalFlag: false });
    }

    const tierMinParam = searchParams.get("tierMin");
    if (tierMinParam) {
      const parsedTierMin = parseInt(tierMinParam);
      if (!isNaN(parsedTierMin)) {
        conditions.push({ tier: { lte: parsedTierMin } });
      }
    }

    const scoreMin = searchParams.get("scoreMin") || "";
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
          const searchString = areasInBounds.map(areaName => `"${areaName}"`).join(" ");
          geoOrConditions.push({
            AND: [
              { OR: [{ latitude: null }, { longitude: null }] },
              {
                OR: [
                  { location: { search: searchString } },
                  { locationAr: { search: searchString } }
                ]
              }
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

    const minimal = searchParams.get("minimal") === "true";
    const selectFields = minimal ? {
      id: true, name: true, nameAr: true, company: true, companyAr: true,
      role: true, roleAr: true, source: true, sourceType: true, tier: true,
      phone: true, email: true, location: true, locationAr: true, score: true, propertyPref: true,
      budgetMin: true, budgetMax: true, latitude: true, longitude: true,
      relocated: true, rentalFlag: true, status: true, bitrix24Id: true,
      agentId: true, scrapeRunId: true, createdAt: true, updatedAt: true,
      signals: true, persona: true, notes: true
    } : undefined;

    // Adjust limit dynamically based on payload size
    const finalLimit = minimal ? Math.min(1000, limit) : Math.min(500, limit);

    // ─── Sequential read queries ──────────────────────────────────────────────
    // Running queries sequentially allows the first query to warm up the database 
    // connection pool, preventing concurrent handshake conflicts and connection pool timeouts (P2024).
    const leads = await prisma.lead.findMany({
      where,
      select: selectFields,
      orderBy: { createdAt: "desc" },
      skip,
      take: finalLimit,
    });
    const total = await prisma.lead.count({ where });

    const parsedLeads = leads.map((lead: any) => {
      let parsedSignals: any[] = [];
      try {
        if (typeof lead.signals === 'string') {
          if (lead.signals.trim().startsWith('[')) {
            parsedSignals = JSON.parse(lead.signals);
          } else if (lead.signals.trim() !== '') {
            parsedSignals = lead.signals.split(',').map((s: string) => s.trim());
          }
        } else if (Array.isArray(lead.signals)) {
          parsedSignals = lead.signals;
        } else if (lead.signals && typeof lead.signals === 'object') {
          parsedSignals = Object.values(lead.signals);
        }
      } catch (e) {
        if (typeof lead.signals === 'string') {
          parsedSignals = lead.signals.split(',').map((s: string) => s.trim());
        }
      }

      let parsedPropertyPref = lead.propertyPref;
      try {
         if (typeof lead.propertyPref === 'string') {
            parsedPropertyPref = JSON.parse(lead.propertyPref);
         }
      } catch(e) {}

      return {
        ...lead,
        signals: Array.isArray(parsedSignals) ? parsedSignals : [],
        propertyPref: parsedPropertyPref,
      };
    });

    const isMatchedFallback = parsedLeads.some((lead: any) =>
      lead.sourceType === "Match" || (typeof lead.source === 'string' && lead.source.includes("(Match "))
    );

    return NextResponse.json({
      leads: parsedLeads,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      isMatchedFallback: isMatchedFallback || false
    });
  } catch (error: any) {
    console.error("Leads fetch error:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    }, { status: 500 });
  }
}
