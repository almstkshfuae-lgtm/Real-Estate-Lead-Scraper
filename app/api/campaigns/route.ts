import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const groupBy = searchParams.get("groupBy") || "propertyType"; // 'propertyType' or 'tier'

    const leads = await prisma.lead.findMany({
      where: session.role.toUpperCase() !== "ADMIN" ? { agentId: session.id } : {},
      select: {
        id: true,
        name: true,
        company: true,
        propertyPref: true,
        tier: true,
        status: true,
        phone: true,
        email: true,
      },
    });

    // Group leads in memory
    const groups: Record<string, any[]> = {};

    leads.forEach((lead) => {
      let key = "unknown";
      
      if (groupBy === "propertyType") {
        const pref = lead.propertyPref as any;
        key = pref?.type || "unknown";
      } else if (groupBy === "tier") {
        key = `T${lead.tier || 3}`;
      }

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(lead);
    });

    const data = Object.entries(groups).map(([groupKey, groupLeads]) => ({
      key: groupKey,
      count: groupLeads.length,
      leads: groupLeads,
    })).sort((a, b) => b.count - a.count); // Largest groups first

    return NextResponse.json({ data }, { status: 200 });

  } catch (error: any) {
    console.error("[Campaigns Error]", error?.message || error);
    return NextResponse.json(
      { error: "Internal Server Error", detail: error?.message },
      { status: 500 }
    );
  }
}
