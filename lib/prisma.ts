import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const prismaClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined. Please set it in your environment variables.');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['query', 'info', 'warn', 'error'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export { prisma }
export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma
