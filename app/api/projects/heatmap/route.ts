import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    
    const where: any = {};
    const conditions: any[] = [];

    if (search) {
      conditions.push({
        OR: [
          { projectName: { contains: search } },
          { location: { contains: search } },
          { developer: { contains: search } },
          { propertyType: { contains: search } },
        ]
      });
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
