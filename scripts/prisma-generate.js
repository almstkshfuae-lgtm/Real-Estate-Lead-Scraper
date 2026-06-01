import { execSync } from 'child_process';

const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
const schema = isProduction ? 'prisma/schema.mysql.prisma' : 'prisma/schema.prisma';

console.log(`📦 Generating Prisma Client using schema: ${schema}`);
execSync(`npx prisma generate --schema ${schema}`, { stdio: 'inherit' });

if (isProduction && process.env.DATABASE_URL) {
  console.log('🚀 Deploying Prisma migrations for production database');
  try {
    execSync(`npx prisma migrate deploy --schema ${schema}`, { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to deploy Prisma migrations:', error);
    process.exit(1);
  }
} else if (isProduction) {
  console.warn('Skipping Prisma migrate deploy because DATABASE_URL is not configured.');
}
