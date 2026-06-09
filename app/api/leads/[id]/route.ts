import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionWithDBVerify } from "@/lib/auth";
import { updateContact } from "@/lib/bitrix24";
import { normalizeLocation, resolveCoords } from "@/lib/ai";
import { cleanPhone, cleanEmail } from "@/lib/sanitizer";
import { z } from "zod";

const leadUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name cannot be empty").optional(),
  email: z.string().trim().email("Invalid email format").nullable().or(z.literal("")).optional(),
  phone: z.string().trim().nullable().optional(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  score: z.union([z.number(), z.string()]).optional(),
  budgetMin: z.union([z.number(), z.string()]).nullable().optional(),
  budgetMax: z.union([z.number(), z.string()]).nullable().optional(),
  status: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  tier: z.union([z.number(), z.string()]).optional(),
  source: z.string().trim().optional(),
});

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

    const validation = leadUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid input data", details: validation.error.format() }, { status: 400 });
    }

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
      notes,
      tier,
      source
    } = validation.data;

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Non-admins cannot edit core lead info fields
    const isNonAdmin = session.role?.toUpperCase() !== 'ADMIN';
    if (isNonAdmin) {
      const editFields = [name, email, phone, company, role, location, score, budgetMin, budgetMax, tier, source];
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

    const targetEmail = (email !== undefined && email !== null) ? cleanEmail(email) : (email === null ? null : undefined);
    if (targetEmail) {
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

    const parsedScore = score !== undefined ? (typeof score === 'number' ? score : parseInt(score, 10)) : undefined;
    let computedTier = undefined;
    if (parsedScore !== undefined && !isNaN(parsedScore)) {
      if (parsedScore >= 90) computedTier = 1;
      else if (parsedScore >= 60) computedTier = 2;
      else computedTier = 3;
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: targetEmail }),
        ...(phone !== undefined && { phone: phone ? cleanPhone(phone) : null }),
        ...(company !== undefined && { company: company.trim() }),
        ...(role !== undefined && { role: role.trim() }),
        ...(location !== undefined && {
          location: location.trim(),
          latitude: lat,
          longitude: lng
        }),
        ...(parsedScore !== undefined && { score: isNaN(parsedScore) ? 50 : parsedScore }),
        ...(tier !== undefined ? { tier: typeof tier === 'number' ? tier : parseInt(tier, 10) } : computedTier !== undefined ? { tier: computedTier } : {}),
        ...(source !== undefined && { source: source.trim() }),
        ...(budgetMin !== undefined && { budgetMin: budgetMin !== "" && budgetMin !== null ? (typeof budgetMin === 'number' ? budgetMin : parseFloat(budgetMin)) : null }),
        ...(budgetMax !== undefined && { budgetMax: budgetMax !== "" && budgetMax !== null ? (typeof budgetMax === 'number' ? budgetMax : parseFloat(budgetMax)) : null }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
    });

    // Create Audit Log
    try {
      const updatedFields: string[] = [];
      if (name !== undefined) updatedFields.push("name");
      if (email !== undefined) updatedFields.push("email");
      if (phone !== undefined) updatedFields.push("phone");
      if (company !== undefined) updatedFields.push("company");
      if (role !== undefined) updatedFields.push("role");
      if (location !== undefined) updatedFields.push("location");
      if (score !== undefined) updatedFields.push("score");
      if (budgetMin !== undefined || budgetMax !== undefined) updatedFields.push("budget");
      if (status !== undefined) updatedFields.push(`status: ${status}`);
      if (notes !== undefined) updatedFields.push("notes");
      if (tier !== undefined) updatedFields.push("tier");
      if (source !== undefined) updatedFields.push("source");

      await prisma.auditLog.create({
        data: {
          action: "UPDATE",
          entityType: "Lead",
          entityId: id,
          agentId: session.id,
          details: `Updated fields: ${updatedFields.join(", ") || "none"}`
        }
      });
    } catch (auditErr) {
      console.error("Failed to create update audit log:", auditErr);
    }

    // CRM Sync: If the lead is already exported to Bitrix24, sync the new data
    if (updatedLead.bitrix24Id) {
      const b24Domain = process.env.BITRIX24_DOMAIN;
      const b24Token = process.env.BITRIX24_WEBHOOK_TOKEN;
      if (b24Domain && b24Token) {
        // Fire and forget so we don't block the UI response
        updateContact(b24Domain, b24Token, updatedLead.bitrix24Id, updatedLead).catch(console.error);
      }
    }

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

    await prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          action: "SOFT_DELETE",
          entityType: "Lead",
          entityId: id,
          agentId: session.id,
          details: `Soft deleted lead: ${lead.name} (${lead.company})`
        }
      });
    } catch (auditErr) {
      console.error("Failed to create delete audit log:", auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
