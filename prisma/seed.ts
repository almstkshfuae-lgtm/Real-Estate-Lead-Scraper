import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_SCRAPER_SOURCES } from '../scraper-service/default-sources.js';
import { encryptJson } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.PRISMA_MIGRATE_DEPLOY === '1') {
    console.log('Skipping seed script in production/deployment environment.');
    return;
  }

  // Seed/Sync default sources config
  console.log('Syncing default scraper sources...');
  for (const source of DEFAULT_SCRAPER_SOURCES) {
    await prisma.sourceConfig.upsert({
      where: { key: source.key },
      update: {
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: encryptJson(source.navigationSelectors),
        contentSelectors: encryptJson(source.contentSelectors),
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
      },
      create: {
        key: source.key,
        url: source.url,
        name: source.name,
        type: source.type,
        signals: source.signals,
        navigationSelectors: encryptJson(source.navigationSelectors),
        contentSelectors: encryptJson(source.contentSelectors),
        crawlDepth: source.crawlDepth,
        maxPages: source.maxPages,
        delayBetweenPages: source.delayBetweenPages,
        active: true,
      },
    });
  }
  console.log(`Synced ${DEFAULT_SCRAPER_SOURCES.length} default sources.`);

  // Double protection: skip if the database already has leads
  const existingCount = await prisma.lead.count();
  if (existingCount > 0) {
    console.log(`Database already contains ${existingCount} leads. Skipping mock data seeding.`);
    return;
  }

  // 1. Admin User
  const adminEmail = 'admin@brilliance-lead.uk';
  const hashedPassword = await bcrypt.hash('almstkshf@2030', 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
    },
    create: {
      email: adminEmail,
      passwordHash: hashedPassword,
      name: 'Super Admin',
      nameAr: 'المسؤول العام',
      role: 'admin',
      language: 'en',
    },
  });

  console.log('Seeded admin user:', admin.email);

  // 2. Realistic UAE Leads
  const scrapeRun = await prisma.scrapeRun.create({
    data: {
      triggeredBy: admin.id,
      sources: JSON.stringify(["Manual Seed"]),
      criteria: JSON.stringify({}),
      status: "COMPLETED",
      leadsFound: 35,
    }
  });

  const leadsData = [
    {
      name: "Omar Al Mansouri",
      nameAr: "عمر المنصوري",
      company: "Al Masaood Group",
      companyAr: "مجموعة المسعود",
      role: "Managing Director",
      roleAr: "العضو المنتدب",
      source: "SerpAPI / Bloomberg",
      tier: 1,
      phone: "+971 50 445 8892",
      email: "omar.m@almasaood.com",
      location: "Abu Dhabi, Al Reem Island",
      score: 94,
      signals: ["UHNW", "Active Investor", "Expansion"],
      propertyPref: { type: "penthouse", beds: 4 },
      budgetMin: 12000000,
      budgetMax: 18000000,
      status: "new",
    },
    {
      name: "Fatima Al Hashimi",
      nameAr: "فاطمة الهاشمي",
      company: "Emirates NBD",
      companyAr: "بنك الإمارات دبي الوطني",
      role: "VP Private Banking",
      roleAr: "نائب رئيس الخدمات المصرفية الخاصة",
      source: "LinkedIn / Web Scrape",
      tier: 1,
      phone: "+971 56 223 9901",
      email: "f.alhashimi@emiratesnbd.com",
      location: "Dubai, Emirates Hills",
      score: 91,
      signals: ["Wealth Manager", "High Budget", "Villa Buyer"],
      propertyPref: { type: "villa", beds: 6 },
      budgetMin: 25000000,
      budgetMax: 45000000,
      status: "qualified",
    },
    {
      name: "John Miller",
      nameAr: "جون ميلر",
      company: "Standard Chartered UAE",
      companyAr: "ستاندرد تشارترد الإمارات",
      role: "Head of Operations",
      roleAr: "رئيس العمليات",
      source: "PropertyFinder",
      tier: 2,
      phone: "+971 52 887 1122",
      email: "john.miller@sc.com",
      location: "Dubai Marina",
      score: 82,
      signals: ["New to UAE", "Executive", "Cash Buyer"],
      propertyPref: { type: "apartment", beds: 3 },
      budgetMin: 3500000,
      budgetMax: 5000000,
      status: "contacted",
    },
    {
      name: "Sanjay Gupta",
      nameAr: "سانجاي جوبتا",
      company: "Tech Mahindra",
      companyAr: "تيك ماهيندرا",
      role: "Regional Director",
      roleAr: "المدير الإقليمي",
      source: "Bayut",
      tier: 2,
      phone: "+971 55 334 2288",
      email: "s.gupta@techmahindra.com",
      location: "Business Bay",
      score: 78,
      signals: ["Investor", "Rental Potential"],
      propertyPref: { type: "apartment", beds: 2 },
      budgetMin: 1800000,
      budgetMax: 2600000,
      status: "new",
    },
    {
      name: "Khalid Bin Zayed",
      nameAr: "خالد بن زايد",
      company: "Zayed Family Office",
      companyAr: "مكتب زايد العائلي",
      role: "Principal",
      roleAr: "المدير الأساسي",
      source: "SerpAPI / Reuters",
      tier: 1,
      phone: "+971 50 111 0099",
      email: "khalid@zfo.ae",
      location: "Abu Dhabi, Corniche",
      score: 98,
      signals: ["Whale Investor", "Land Acquisition", "Bulk Purchase"],
      propertyPref: { type: "villa", beds: 8 },
      budgetMin: 50000000,
      budgetMax: 150000000,
      status: "new",
    },
    {
      name: "Elena Petrova",
      nameAr: "إيلينا بتروفا",
      company: "Gazprom Marketing",
      companyAr: "غازبروم للتسويق",
      role: "Senior Consultant",
      roleAr: "مستشار أول",
      source: "Dubizzle",
      tier: 3,
      phone: "+971 58 776 5544",
      email: "elena.p@gazprom.ru",
      location: "JLT (Jumeirah Lake Towers)",
      score: 65,
      signals: ["Relocation", "Single Professional"],
      propertyPref: { type: "apartment", beds: 1 },
      budgetMin: 900000,
      budgetMax: 1300000,
      status: "new",
    },
    {
      name: "Mohamed Al Qubaisi",
      nameAr: "محمد القبيسي",
      company: "ADNOC",
      companyAr: "أدنوك",
      role: "Drilling Manager",
      roleAr: "مدير الحفر",
      source: "PropertyFinder",
      tier: 2,
      phone: "+971 50 665 4433",
      email: "m.alqubaisi@adnoc.ae",
      location: "Abu Dhabi, Khalifa City",
      score: 85,
      signals: ["High Salary", "Local Buyer", "Family Home"],
      propertyPref: { type: "villa", beds: 5 },
      budgetMin: 4000000,
      budgetMax: 6500000,
      status: "new",
    }
  ];

  // Add more to reach 30+
  for (let i = 0; i < 25; i++) {
    const names = ["Ahmed", "Sara", "Michael", "Linda", "Ravi", "Chen", "Yousef", "Amna"];
    const lastNames = ["Al Suwaidi", "Smith", "Khan", "Wang", "Al Ketbi", "Johnson"];
    const companies = ["Etisalat", "Du", "DP World", "Mubadala", "ADIA", "Google Gulf", "Amazon UAE"];
    const locations = ["Dubai Marina", "Palm Jumeirah", "Downtown Dubai", "Saadiyat Island", "Yas Island", "Sharjah"];

    const name = `${names[i % names.length]} ${lastNames[i % lastNames.length]}`;
    const company = companies[i % companies.length];

    leadsData.push({
      name: name,
      nameAr: "",
      company: company,
      companyAr: "",
      role: "Executive",
      roleAr: "",
      source: "Automated Scrape",
      tier: (i % 3) + 1,
      phone: `+971 5${i % 9} ${100 + i} ${2000 + i}`,
      email: `${name.toLowerCase().replace(' ', '.')}@${company.toLowerCase().replace(' ', '')}.com`,
      location: locations[i % locations.length],
      score: 60 + (i % 35),
      signals: ["Investor", "Market Signal"],
      propertyPref: { type: "apartment", beds: 2 },
      budgetMin: 1000000 + (i * 200000),
      budgetMax: 1500000 + (i * 250000),
      status: "new",
    });
  }

  for (const lead of leadsData) {
    // Build payload without scrapeRunId (now tracked via LeadScrapeRun join table)
    const leadPayload = {
      name: lead.name,
      nameAr: lead.nameAr,
      company: lead.company,
      companyAr: lead.companyAr,
      role: lead.role,
      roleAr: lead.roleAr,
      source: lead.source,
      tier: lead.tier,
      phone: lead.phone,
      email: lead.email,
      location: lead.location,
      score: lead.score,
      signals: lead.signals,
      propertyPref: lead.propertyPref,
      budgetMin: lead.budgetMin,
      budgetMax: lead.budgetMax,
      status: lead.status,
      agentId: admin.id,
    };

    const upserted = await prisma.lead.upsert({
      where: {
        name_company_source_agentId: {
          name: lead.name,
          company: lead.company,
          source: lead.source,
          agentId: admin.id,
        },
      },
      update: leadPayload,
      create: leadPayload,
    });

    // Link lead to the seed scrape run via the join table
    await prisma.leadScrapeRun.upsert({
      where: {
        leadId_scrapeRunId: {
          leadId: upserted.id,
          scrapeRunId: scrapeRun.id,
        },
      },
      create: {
        leadId: upserted.id,
        scrapeRunId: scrapeRun.id,
      },
      update: {},
    });
  }

  console.log('Seeded 30+ realistic leads.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
