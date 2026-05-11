import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { put } from "@vercel/blob";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const tier = searchParams.get("tier") || "";
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { company: { contains: search } },
        { nameAr: { contains: search } },
        { companyAr: { contains: search } },
      ];
    }
    if (status) where.status = status;
    if (tier) where.tier = parseInt(tier);

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const exportData = leads.map(lead => ({
      "Name (EN)": lead.name,
      "Name (AR)": lead.nameAr || "",
      "Company (EN)": lead.company,
      "Company (AR)": lead.companyAr || "",
      "Role (EN)": lead.role,
      "Role (AR)": lead.roleAr || "",
      "Phone": lead.phone || "N/A",
      "Email": lead.email || "N/A",
      "Location": lead.location,
      "Tier": `T${lead.tier}`,
      "Score": lead.score,
      "Status": lead.status.toUpperCase(),
      "Signals": Array.isArray(lead.signals) ? lead.signals.join(", ") : 
                (typeof lead.signals === 'string' ? JSON.parse(lead.signals).join(", ") : ""),
      "Created At": lead.createdAt.toISOString(),
      "Notes": lead.notes || ""
    }));

    let fileBuffer: Buffer | string;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
      const csv = Papa.unparse(exportData);
      // Add UTF-8 BOM
      fileBuffer = '\uFEFF' + csv;
      contentType = "text/csv; charset=utf-8";
      filename = `brilliance-leads-${Date.now()}.csv`;
    } else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Leads");
      
      if (exportData.length > 0) {
        const headers = Object.keys(exportData[0]);
        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
        
        // Bold headers
        worksheet.getRow(1).font = { bold: true };
        
        exportData.forEach(data => {
          worksheet.addRow(data);
        });
      }

      fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      filename = `brilliance-leads-${Date.now()}.xlsx`;
    }

    // Upload to Vercel Blob
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType,
    });

    // Save ExportHistory
    await prisma.exportHistory.create({
      data: {
        agentId: session.id,
        format: format.toUpperCase(),
        filters: { search, status, tier },
        recordCount: leads.length,
        fileUrl: blob.url,
      }
    });

    return NextResponse.json({ url: blob.url, count: leads.length }, { status: 200 });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
