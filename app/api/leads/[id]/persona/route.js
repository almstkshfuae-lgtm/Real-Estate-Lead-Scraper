import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generatePersonaAnalysis } from "@/lib/ai";
export async function GET(request, { params }) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const lang = searchParams.get("lang") || "en";
        const lead = await prisma.lead.findUnique({
            where: { id },
        });
        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }
        // Agents can only access their own leads
        if (session.role !== 'ADMIN' && lead.agentId !== session.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const persona = await generatePersonaAnalysis(lead, lang);
        // Cache the newly generated/regenerated persona back in the database
        if (lead.persona !== persona) {
            await prisma.lead.update({
                where: { id },
                data: { persona },
            });
        }
        return NextResponse.json({ persona });
    }
    catch (error) {
        console.error("Persona API error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
