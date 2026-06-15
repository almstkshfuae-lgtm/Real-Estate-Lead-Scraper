import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const countManualEntry = await prisma.lead.count({
    where: {
      OR: [
        { company: "Manual Entry" },
        { role: "Imported Lead" }
      ]
    }
  });

  const sample = await prisma.lead.findMany({
    where: {
      OR: [
        { company: "Manual Entry" },
        { role: "Imported Lead" }
      ]
    },
    take: 5
  });

  console.log(`Leads with "Manual Entry" company or "Imported Lead" role: ${countManualEntry}`);
  console.log("Sample leads:", JSON.stringify(sample, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
