import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.projectHeatmap.findMany({
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
