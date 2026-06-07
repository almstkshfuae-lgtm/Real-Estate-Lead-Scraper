import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.sourceConfig.findMany({
    where: {
      OR: [
        { name: { contains: "Forsan" } },
        { key: { contains: "Forsan" } },
        { url: { contains: "Forsan" } }
      ]
    }
  });
  console.log(JSON.stringify(configs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
