import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { computeValidationMetrics } from "@/lib/ml/validation";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Performance optimization: select only columns required for statistical validation
    // Exclude soft-deleted leads to prevent ghost data from skewing statistical metrics
    const leads = await prisma.lead.findMany({
      where: {
        deletedAt: null,
        status: {
          in: ["won", "lost"]
        }
      },
      select: {
        id: true,
        status: true,
        score: true,
        tier: true
      }
    });

    const metrics = computeValidationMetrics(leads);

    return NextResponse.json({
      success: true,
      metrics
    });
  } catch (error: any) {
    console.error("[AI Score Validate Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to validate score", detail: error?.message },
      { status: 500 }
    );
  }
}
