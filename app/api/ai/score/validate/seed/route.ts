import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 1. Create a dummy ScrapeRun for historical outcomes
    const run = await prisma.scrapeRun.create({
      data: {
        triggeredBy: session.name || "System Simulator",
        sources: JSON.stringify(["Historical Outlets", "Registry Archive", "Elite Concierge"]),
        criteria: JSON.stringify({ emirates: ["Dubai", "Abu Dhabi", "Sharjah"] }),
        status: "COMPLETED",
        leadsFound: 550,
        completedAt: new Date()
      }
    });

    const firstNames = [
      "Fahad", "Adnan", "Yousef", "Tareq", "Hamad", "Rashed", "Zayed", "Sultan", "Mansoor", "Khalid",
      "John", "Michael", "David", "Robert", "William", "Elena", "Sophia", "Amira", "Layla", "Fatima"
    ];
    const lastNames = [
      "Al-Mansoori", "Al-Suwaidi", "Al-Ketbi", "Al-Nuaimi", "Al-Fahim", "Al-Badi", "Al-Marzooqi", "Al-Zaabi", "Al-Hashimi", "Al-Rashidi",
      "Smith", "Miller", "Johnson", "Davis", "Petrov", "Sokolov", "Chen", "Mehta", "Patel", "Rossi"
    ];
    const companies = [
      "Gulf Tech Capital", "Desert Venture Partners", "Oasis Family Office", "Emaar Group PJSC", "Habtoor Enterprises",
      "DIFC Investment Trust", "ADGM Wealth Management", "Al-Futtaim Development", "Nakheel Properties", "Sobha Realty",
      "International Capital Holding", "Emirates Sovereign Wealth", "Skyline Global Partners", "Falcon Assets", "Marina Capital"
    ];
    const roles = [
      "Managing Partner", "Chief Investment Officer", "Founder & CEO", "Group President", "Executive Chairman",
      "Managing Director", "Principal Shareholder", "Senior VP", "Equestrian Sponsor", "Advisory Board Member"
    ];
    const locations = [
      "Dubai Marina", "Palm Jumeirah", "Downtown Dubai", "Business Bay", "Saadiyat Island",
      "Al Reem Island", "Yas Island", "Al Raha Beach", "Sharjah City", "Khalidiyah"
    ];
    const signalsList = [
      ["UHNW", "Family Office", "High Net Worth"],
      ["High Net Worth", "Investor"],
      ["Investor", "Private Client"],
      ["Business Owner", "Executive"],
      ["Private Client", "Business Owner", "Investor"],
      ["UHNW", "Investor", "Private Client"]
    ];

    const leadsData = [];

    for (let i = 1; i <= 550; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      // Append index to guarantee uniqueness of [name, company, source, agentId]
      const name = `${firstName} ${lastName} #${i}`;
      const nameAr = `المستثمر ${firstName} ${lastName} #${i}`;
      const company = companies[Math.floor(Math.random() * companies.length)] + ` Ltd`;
      const companyAr = `شركة ` + company;
      const role = roles[Math.floor(Math.random() * roles.length)];
      const roleAr = "مدير تنفيذي";

      // Select Tier and Score range
      const tier = Math.random() < 0.25 ? 1 : Math.random() < 0.55 ? 2 : 3;
      let score = 50;
      if (tier === 1) {
        score = Math.floor(Math.random() * 20) + 80; // 80 - 99
      } else if (tier === 2) {
        score = Math.floor(Math.random() * 20) + 70; // 70 - 89
      } else {
        score = Math.floor(Math.random() * 40) + 40; // 40 - 79
      }

      // Determine outcome (won/lost) based on score to create realistic correlation
      let status = "lost";
      const rand = Math.random();
      if (score >= 90) {
        status = rand < 0.85 ? "won" : "lost";
      } else if (score >= 80) {
        status = rand < 0.65 ? "won" : "lost";
      } else if (score >= 70) {
        status = rand < 0.45 ? "won" : "lost";
      } else if (score >= 60) {
        status = rand < 0.25 ? "won" : "lost";
      } else {
        status = rand < 0.08 ? "won" : "lost";
      }

      const location = locations[Math.floor(Math.random() * locations.length)];
      const signals = signalsList[Math.floor(Math.random() * signalsList.length)];
      const budgetMin = tier === 1 ? 15000000 : tier === 2 ? 5000000 : 1000000;
      const budgetMax = tier === 1 ? 50000000 : tier === 2 ? 15000000 : 3000000;

      leadsData.push({
        name,
        nameAr,
        company,
        companyAr,
        role,
        roleAr,
        source: "Historical Outcome Simulator",
        sourceType: "Simulation",
        tier,
        phone: `+97150${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `investor${i}@simulation-leads.com`,
        location,
        score,
        signals: JSON.stringify(signals),
        propertyPref: JSON.stringify({ types: ["villa", "penthouse"] }),
        budgetMin,
        budgetMax,
        relocated: Math.random() < 0.3,
        rentalFlag: Math.random() < 0.1,
        status,
        persona: `Historical simulated investor profile for statistical validation. Target location: ${location}.`,
        agentId: session.id,
        scrapeRunId: run.id
      });
    }

    // Insert leads in batches of 100 to optimize performance and prevent exceeding query limits
    const batchSize = 100;
    for (let i = 0; i < leadsData.length; i += batchSize) {
      const batch = leadsData.slice(i, i + batchSize);
      await prisma.lead.createMany({
        data: batch as any
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded 550 historical outcome leads (linked to ScrapeRun: ${run.id}).`,
      scrapeRunId: run.id
    });
  } catch (error: any) {
    console.error("[AI Score Seed Error]", error?.message || error);
    return NextResponse.json(
      { error: "Failed to seed historical leads", detail: error?.message },
      { status: 500 }
    );
  }
}
