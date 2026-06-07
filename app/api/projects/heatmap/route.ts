import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const projects = await prisma.projectHeatmap.findMany({
      select: {
        id: true,
        projectName: true,
        location: true,
        startingPrice: true,
        propertyType: true,
      },
    });
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("[Projects API] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
