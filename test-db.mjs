import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ log: ['query', 'info', 'warn', 'error'] });

async function main() {
  try {
    const start = Date.now();
    const count = await prisma.lead.count();
    console.log(`Connection successful. Total leads: ${count}. Time taken: ${Date.now() - start}ms`);
  } catch (e) {
    console.error('Database connection failed:', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
