import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSearchConditions } from "@/lib/search";
import { getAreasInBounds } from "@/lib/areas";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    
    const where: any = {};
    const conditions: any[] = [];

    if (search) {
      const searchFields = ["projectName", "location", "developer", "propertyType"];
      conditions.push(...buildSearchConditions(search, searchFields));
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

        // Add fallback to text matching for projects without precise coordinates
        const geoOrConditions: any[] = [{ AND: coordConditions }];
        const areasInBounds = getAreasInBounds(north, south, east, west);

        if (areasInBounds.length > 0) {
          const textMatches = areasInBounds.flatMap(areaName => [
            { location: { contains: areaName } }
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
        OR: buildSearchConditions(locationParam, ["location"])
      });
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const projects = await prisma.projectHeatmap.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Map the database fields to the frontend expected format (lat/lng)
    // although the frontend should accept latitude/longitude, let's keep it compatible
    const formattedProjects = projects.map(p => ({
      id: p.id,
      projectName: p.projectName,
      location: p.location,
      developer: p.developer,
      startingPrice: p.startingPrice,
      areaSqft: p.areaSqft,
      handover: p.handoverDate,
      lat: p.latitude,
      lng: p.longitude,
      imageUrl: p.imageUrl,
    }));

    return NextResponse.json({ projects: formattedProjects });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json({ projects: [] });
  }
}
