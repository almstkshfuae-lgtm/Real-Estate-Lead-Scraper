import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { trainModel } from "@/lib/ml/lead-model";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await trainModel();

    if (!result.success) {
      return NextResponse.json({ 
        message: result.message,
        currentCount: result.leadsCount,
        requiredCount: 500
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: "Model trained successfully on lead outcomes.",
      data: {
        trainedLeadsCount: result.leadsCount,
        featureImportance: result.featureImportance,
        accuracy: result.accuracy,
        loss: result.loss
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("ML Train error:", error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
