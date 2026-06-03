import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const users = await p.user.findMany({ select: { id: true, email: true, role: true } });
  console.log(JSON.stringify(users, null, 2));
} catch (e) {
  console.error('DB error:', e.message);
} finally {
  await p.$disconnect();
}
