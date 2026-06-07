import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
console.log("Model properties:", Object.getOwnPropertyNames(p).filter(x => !x.startsWith('$')));
p.$disconnect();
