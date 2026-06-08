import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Convert empty strings to null or correct types where needed
    const parsedData = {
      ...data,
      startingPrice: data.startingPrice ? Number(data.startingPrice) : null,
      areaSqft: data.areaSqft ? Number(data.areaSqft) : null,
      latitude: data.latitude ? Number(data.latitude) : null,
      longitude: data.longitude ? Number(data.longitude) : null,
      sourceUrl: data.sourceUrl || "",
    };

    const project = await prisma.projectHeatmap.create({
      data: parsedData,
    });

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("Failed to create project:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
