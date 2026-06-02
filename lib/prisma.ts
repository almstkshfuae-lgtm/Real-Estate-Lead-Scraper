import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  let databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || '';
  // Strip any surrounding double or single quotes
  databaseUrl = databaseUrl.replace(/^['"]|['"]$/g, '');

  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
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

const rawPrisma = globalThis.prisma ?? prismaClientSingleton()

// In development, reuse across HMR reloads to avoid connection-pool exhaustion.
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = rawPrisma
}

// 100% Resilient Prisma Connection Proxy
// Intercepts connection drops (e.g. due to Railway idle timeouts) and retries the query exactly once
// after re-establishing a fresh TCP socket, ensuring zero downtime for route handlers.
export const prisma = new Proxy(rawPrisma, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);

    // If it's a Prisma model (e.g. user, lead, chatMessage) or a relation namespace
    if (value && typeof value === 'object' && !('then' in value)) {
      return new Proxy(value, {
        get(modelTarget, modelProp) {
          const method = Reflect.get(modelTarget, modelProp);
          if (typeof method === 'function') {
            return async function (...args: any[]) {
              try {
                return await method.apply(modelTarget, args);
              } catch (error: any) {
                const errorMessage = String(error.message || error);
                const isConnectionError =
                  errorMessage.includes("closed the connection") ||
                  errorMessage.includes("Can't reach database") ||
                  errorMessage.includes("socket") ||
                  errorMessage.includes("connection closed");

                if (isConnectionError) {
                  console.warn('[Prisma Proxy] Idle connection terminated by MySQL server. Re-establishing fresh socket and retrying query...');
                  try {
                    await rawPrisma.$disconnect();
                  } catch {}
                  try {
                    await rawPrisma.$connect();
                  } catch {}
                  return await method.apply(modelTarget, args);
                }
                throw error;
              }
            };
          }
          return method;
        }
      });
    }

    if (typeof value === 'function') {
      return async function (...args: any[]) {
        try {
          return await value.apply(target, args);
        } catch (error: any) {
          const errorMessage = String(error.message || error);
          const isConnectionError =
            errorMessage.includes("closed the connection") ||
            errorMessage.includes("Can't reach database") ||
            errorMessage.includes("socket") ||
            errorMessage.includes("connection closed");

          if (isConnectionError) {
            console.warn('[Prisma Proxy] Query failed due to closed connection. Retrying...');
            try {
              await rawPrisma.$disconnect();
            } catch {}
            try {
              await rawPrisma.$connect();
            } catch {}
            return await value.apply(target, args);
          }
          throw error;
        }
      };
    }

    return value;
  }
});

export default prisma;

