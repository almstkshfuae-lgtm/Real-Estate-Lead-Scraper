import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Fetching all leads...');
  const leads = await prisma.lead.findMany();
  console.log(`Found ${leads.length} leads. Starting re-evaluation...`);

  let updated = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    
    // Evaluate Tier strictly based on Job Role
    const roleContent = String(lead.role || '').toLowerCase();
    
    let computedTier = 3;
    let computedScore = lead.score || 50;

    if (/\b(ceo|founder|co-founder|chairman|president|owner|sheikh|minister|royal)\b/i.test(roleContent)) {
      computedTier = 1;
      computedScore = Math.max(computedScore, Math.floor(Math.random() * 10) + 90); // 90-100
    } else if (/\b(director|managing director|general manager|head|partner|vp|vice president)\b/i.test(roleContent)) {
      computedTier = 2;
      computedScore = Math.max(computedScore, Math.floor(Math.random() * 19) + 70); // 70-89
    } else if (/\b(manager|specialist|physician|associate|consultant|executive|member)\b/i.test(roleContent)) {
      computedTier = 3;
      computedScore = Math.floor(Math.random() * 19) + 50; // 50-69
    } else {
      computedTier = 3; // Default for normal employees
      computedScore = Math.floor(Math.random() * 20) + 30; // 30-50
    }

    if (lead.tier !== computedTier || lead.score !== computedScore) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { tier: computedTier, score: computedScore }
      });
      console.log(`[${i+1}/${leads.length}] Updated: ${lead.name} (${lead.role}) -> Tier ${computedTier}, Score ${computedScore}`);
      updated++;
    }
  }

  console.log(`\nRe-evaluation complete! Updated ${updated} leads.`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
