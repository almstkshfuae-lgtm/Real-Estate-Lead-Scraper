import { execSync } from 'child_process';

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV === 'production';
const isProduction = process.env.NODE_ENV === 'production';
const schema = isVercel || isProduction ? 'prisma/schema.mysql.prisma' : 'prisma/schema.prisma';

console.log(`📦 Generating Prisma Client using schema: ${schema}`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' });
