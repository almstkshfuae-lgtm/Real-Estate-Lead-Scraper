import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const leads = [
    // ===== OUR NEWLY EXTRACTED ELITE LEAD =====
    {
        name: 'Sheikh Ahmed Al Habtoor',
        nameAr: 'الشيخ أحمد الحبتور',
        company: 'Al Habtoor Group',
        companyAr: 'مجموعة الحبتور',
        role: 'Chairman & Patron',
        roleAr: 'رئيس مجلس الإدارة والراعي',
        source: 'Al Habtoor Polo Club VIPs',
        sourceType: 'Elite Lifestyle & Club',
        tier: 1,
        phone: '+971 50 777 8888',
        email: 'ahmed.habtoor@alhabtoorgh.ae',
        location: 'Dubai',
        score: 95,
        signals: ['Polo Patron', 'Group Chairman', 'Real Estate Investor', 'Off-plan Villas', 'Waterfront Property'],
        propertyPref: { types: ['villa', 'penthouse'], bedrooms: '5+' },
        budgetMin: 25000000,
        budgetMax: 25000000,
        relocated: false,
        rentalFlag: false,
        status: 'new',
        persona: "An elite UHNWI and active polo patron, Sheikh Ahmed is focused on expanding his high-value residential portfolio. He seeks off-plan waterfront villas in prime locations like Palm Jumeirah, indicating a preference for luxury, growth-oriented investments with significant capital appreciation potential."
    },
    // ===== TIER 1 ELITE =====
    {
        name: 'Khalid Al Mansouri',
        nameAr: 'خالد المنصوري',
        company: 'Al Mansouri Family Office',
        companyAr: 'مكتب عائلة المنصوري',
        role: 'Principal Investor',
        roleAr: 'مستثمر رئيسي',
        source: 'ADGM Registry',
        sourceType: 'Company Registry',
        tier: 1,
        phone: '+971501234567',
        email: 'k.almansouri@mansourifo.ae',
        location: 'Abu Dhabi',
        score: 97,
        signals: ['UHNW', 'Family Office', 'High Net Worth'],
        propertyPref: { types: ['penthouse', 'villa'], bedrooms: '5+' },
        budgetMin: 15000000,
        budgetMax: 50000000,
        relocated: false,
        rentalFlag: false,
        status: 'new',
        persona: 'A high-value UAE family office investor looking for elite penthouses in prime locations.'
    },
    {
        name: 'Rashed Al Nuaimi',
        nameAr: 'راشد النعيمي',
        company: 'Gulf Capital Partners',
        companyAr: 'شركاء الخليج للاستثمار',
        role: 'Managing Director',
        roleAr: 'المدير العام',
        source: 'DIFC Registry',
        sourceType: 'Company Registry',
        tier: 1,
        phone: '+971502345678',
        email: 'rashed@gulfcapitalpartners.ae',
        location: 'Dubai',
        score: 96,
        signals: ['UHNW', 'Private Client', 'Investor'],
        propertyPref: { types: ['penthouse', 'apartment'], bedrooms: '4+' },
        budgetMin: 12000000,
        budgetMax: 35000000,
        relocated: false,
        rentalFlag: false,
        status: 'contacted',
        persona: 'A prominent private wealth investor looking for high-end penthouse opportunities in Dubai Marina.'
    },
    {
        name: 'Anastasia Volkov',
        nameAr: 'أناستاسيا فولكوف',
        company: 'Volkov International Holdings',
        companyAr: 'فولكوف إنترناشيونال القابضة',
        role: 'CEO',
        roleAr: 'الرئيس التنفيذي',
        source: 'Private Banking Directory',
        sourceType: 'Wealth Directory',
        tier: 1,
        phone: '+971503456789',
        email: 'a.volkov@volkovholdings.com',
        location: 'Dubai',
        score: 95,
        signals: ['UHNW', 'Recently Relocated', 'High Net Worth'],
        propertyPref: { types: ['villa', 'penthouse'], bedrooms: '6+' },
        budgetMin: 20000000,
        budgetMax: 80000000,
        relocated: true,
        rentalFlag: false,
        status: 'qualified',
        persona: 'An international executive relocated to Dubai, searching for premium mansions and luxury villas.'
    },
    {
        name: 'Sarah Al Khateeb',
        nameAr: 'سارة الخطيب',
        company: 'Concierge Elite Dubai',
        companyAr: 'كونسيرج إيليت دبي',
        role: 'Senior Client Advisor',
        roleAr: 'مستشار عملاء أول',
        source: 'Elite Lifestyle & Concierge',
        sourceType: 'Lifestyle Club',
        tier: 2,
        phone: '+971500123456',
        email: 's.alkhateeb@eliteconcierge.ae',
        location: 'Dubai',
        score: 78,
        signals: ['Private Client', 'High Net Worth'],
        propertyPref: { types: ['apartment', 'penthouse'], bedrooms: '2+' },
        budgetMin: 2000000,
        budgetMax: 7000000,
        relocated: false,
        rentalFlag: false,
        status: 'contacted',
        persona: 'A high-net-worth concierge client looking for secondary holiday apartments in Dubai.'
    }
];
async function main() {
    console.log('🌱 Finding active admin user in the database...');
    const admin = await prisma.user.findFirst({
        where: { role: 'admin' }
    });
    if (!admin) {
        throw new Error('No admin user found in database. Run signup or database seed first.');
    }
    console.log(`Found active admin user: ${admin.email} (ID: ${admin.id})`);
    console.log('🧹 Cleaning existing leads to prevent duplicates...');
    await prisma.lead.deleteMany({});
    await prisma.scrapeRun.deleteMany({});
    console.log('📦 Creating fresh ScrapeRun record...');
    const scrapeRun = await prisma.scrapeRun.create({
        data: {
            triggeredBy: admin.name,
            sources: JSON.stringify(['ADGM', 'DIFC', 'Al Habtoor']),
            criteria: JSON.stringify({ emirates: ['Dubai', 'Abu Dhabi'] }),
            status: 'COMPLETED',
            leadsFound: leads.length,
            completedAt: new Date()
        }
    });
    console.log(`Created ScrapeRun with ID: ${scrapeRun.id}`);
    console.log('🚀 Seeding leads with correct relations...');
    let count = 0;
    for (const lead of leads) {
        await prisma.lead.create({
            data: {
                name: lead.name,
                nameAr: lead.nameAr,
                company: lead.company,
                companyAr: lead.companyAr,
                role: lead.role,
                roleAr: lead.roleAr,
                source: lead.source,
                sourceType: lead.sourceType,
                tier: lead.tier,
                phone: lead.phone,
                email: lead.email,
                location: lead.location,
                score: lead.score,
                signals: JSON.stringify(lead.signals),
                propertyPref: JSON.stringify(lead.propertyPref),
                budgetMin: lead.budgetMin,
                budgetMax: lead.budgetMax,
                relocated: lead.relocated,
                rentalFlag: lead.rentalFlag,
                status: lead.status,
                persona: lead.persona,
                agentId: admin.id,
                scrapeRunId: scrapeRun.id
            }
        });
        count++;
        console.log(`  ✓ Inserted lead [${count}/${leads.length}]: ${lead.name}`);
    }
    console.log(`\n🎉 Successfully seeded ${count} active leads in the database!`);
}
main()
    .catch((e) => {
    console.error('❌ Failed to seed active leads:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
