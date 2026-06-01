import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL,
      },
    },
    // Minimal logs in production to reduce noise; full logs in dev
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    errorFormat: 'minimal',
  })

  return client
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

// In development, reuse across HMR reloads to avoid connection-pool exhaustion.
// In production every serverless invocation gets a fresh module (no leak risk).
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

export { prisma }
export default prisma

