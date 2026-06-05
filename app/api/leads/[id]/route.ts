import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";
import { normalizeLocation, resolveCoords } from "@/lib/ai";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      email,
      phone,
      company,
      role,
      location,
      score,
      budgetMin,
      budgetMax,
      status,
      notes
    } = body;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Non-admins cannot edit core lead info fields
    const isNonAdmin = session.role?.toUpperCase() !== 'ADMIN';
    if (isNonAdmin) {
      const editFields = [name, email, phone, company, role, location, score, budgetMin, budgetMax];
      const hasRestrictedEdit = editFields.some(field => field !== undefined);
      if (hasRestrictedEdit) {
        return NextResponse.json({ error: "Only admins are allowed to edit lead details." }, { status: 403 });
      }
    }

    // Agents can only update their own leads
    if (isNonAdmin && lead.agentId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Deduplication check on update
    const targetName = name !== undefined ? name.trim() : lead.name;
    const targetCompany = company !== undefined ? company.trim() : lead.company;

    if ((name !== undefined || company !== undefined) && targetName && targetCompany) {
      const existingByUnique = await prisma.lead.findFirst({
        where: {
          id: { not: id },
          name: targetName,
          company: targetCompany,
          agentId: lead.agentId,
        },
      });

      if (existingByUnique) {
        return NextResponse.json(
          { error: `A lead with name "${targetName}" and company "${targetCompany}" already exists.` },
          { status: 400 }
        );
      }
    }

    if (email !== undefined && email) {
      const targetEmail = email.trim().toLowerCase();
      const existingByEmail = await prisma.lead.findFirst({
        where: {
          id: { not: id },
          email: targetEmail,
          agentId: lead.agentId,
        },
      });

      if (existingByEmail) {
        return NextResponse.json(
          { error: `A lead with email "${targetEmail}" already exists.` },
          { status: 400 }
        );
      }
    }

    let lat = undefined;
    let lng = undefined;
    if (location !== undefined) {
      const normalized = normalizeLocation(location.trim());
      const coords = resolveCoords(normalized);
      lat = coords.lat;
      lng = coords.lng;
    }

    const parsedScore = score !== undefined ? parseInt(score, 10) : undefined;

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email ? email.trim().toLowerCase() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(company !== undefined && { company: company.trim() }),
        ...(role !== undefined && { role: role.trim() }),
        ...(location !== undefined && {
          location: location.trim(),
          latitude: lat,
          longitude: lng
        }),
        ...(parsedScore !== undefined && { score: isNaN(parsedScore) ? 50 : parsedScore }),
        ...(budgetMin !== undefined && { budgetMin: budgetMin !== "" && budgetMin !== null ? parseFloat(budgetMin) : null }),
        ...(budgetMax !== undefined && { budgetMax: budgetMax !== "" && budgetMax !== null ? parseFloat(budgetMax) : null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ lead: updatedLead });
  } catch (error) {
    console.error("Lead update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Agents can only delete their own leads
    const isNonAdmin = session.role?.toUpperCase() !== 'ADMIN';
    if (isNonAdmin && lead.agentId !== session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.lead.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
