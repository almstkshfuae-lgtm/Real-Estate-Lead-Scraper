import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.notification.deleteMany({
    where: {
      title: { contains: "Al Forsan" }
    }
  });
  console.log(`Deleted ${result.count} old notifications about Al Forsan.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
