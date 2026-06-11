import { PrismaClient } from '@prisma/client';
import { buildSearchConditions } from '../lib/search.ts';
const prisma = new PrismaClient();

async function testQuery(search, fields) {
  const conditions = buildSearchConditions(search, fields);
  console.log(`\nSearch query: "${search}"`);
  console.log('Built conditions count:', conditions.length);
  
  const results = await prisma.lead.findMany({
    where: {
      AND: conditions
    },
    take: 5
  });
  
  console.log(`Found ${results.length} results:`);
  results.forEach(lead => {
    console.log(`- ID: ${lead.id}, Name: "${lead.name}", NameAr: "${lead.nameAr}", Company: "${lead.company}", CompanyAr: "${lead.companyAr}"`);
  });
}

async function main() {
  try {
    // 1. Let's find some leads with Arabic characters to see what we have
    const arabicLeads = await prisma.lead.findMany({
      where: {
        OR: [
          { nameAr: { not: null } },
          { companyAr: { not: null } }
        ]
      },
      take: 5
    });

    console.log('Sample Arabic leads in DB:', arabicLeads.length);
    arabicLeads.forEach(lead => {
      console.log(`- ID: ${lead.id}, Name: "${lead.name}", NameAr: "${lead.nameAr}", Company: "${lead.company}", CompanyAr: "${lead.companyAr}"`);
    });

    const fields = ["name", "nameAr", "company", "companyAr", "location"];

    // 2. Perform some search queries
    await testQuery("ahmad", fields); // case-insensitive English search test
    
    // If we have Arabic leads, let's test variations.
    // Otherwise let's temporarily create a lead to test Arabic variations!
    {
      console.log('\nCreating a temporary lead for Arabic search testing...');
      const tempLead = await prisma.lead.create({
        data: {
          name: "Temporary Test Investor",
          nameAr: "أسامة بن لادن العقارية", // Example with Alif, Ta Marbouta, etc.
          company: "Al-Khaleej Development",
          companyAr: "الشركة الشرقية للتطوير",
          role: "Investor",
          roleAr: "مستثمر",
          source: "Test Source",
          tier: 1,
          location: "Dubai",
          score: 80,
          signals: [],
          propertyPref: {},
          agentId: "cmq2nbngr00007b2fl4x50474", // Use the agent ID from query-leads.js output
          scrapeRunId: "cmq9sao3n000283mk1za3j5zd" // Use the scrapeRunId from query-leads.js output
        }
      });
      console.log(`Created temp lead: ${tempLead.id}`);

      // Now query with spelling variations:
      // "اسامه" (ending with Haa instead of Ta Marbouta, and normal Alif instead of Hamza)
      await testQuery("اسامه", fields);
      
      // "الشرقيه" (with Alif Lam, ending with Haa instead of Ta Marbouta)
      await testQuery("الشرقيه", fields);
      
      // "شرقية" (without Alif Lam, ending with Ta Marbouta)
      await testQuery("شرقية", fields);

      // Clean up temp lead
      await prisma.lead.delete({
        where: { id: tempLead.id }
      });
      console.log('Temporary lead deleted.');
    }
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
