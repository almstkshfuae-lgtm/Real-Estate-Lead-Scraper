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

  // Lazily connect on first query rather than during module import.
  // This avoids build-time connection noise when local env configuration is not yet set.
  const connectWithRetry = async (maxRetries = 5, delay = 3000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.$connect()
        console.log('[Prisma] Connected successfully')
        return
      } catch (err) {
        console.error(`[Prisma] Connection attempt ${attempt}/${maxRetries} failed:`, (err as Error).message)
        if (attempt < maxRetries) {
          console.log(`[Prisma] Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
  }

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

