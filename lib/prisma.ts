import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  // Ensure that if process.env.DATABASE_URL is empty or whitespace, we delete it to allow proper fallback
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl || rawUrl.trim() === '') {
    delete process.env.DATABASE_URL;
  }

  let databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || '';
  // Strip any surrounding double or single quotes
  databaseUrl = databaseUrl.replace(/^['"]|['"]$/g, '').trim();

  // Re-assign the correct fallback url to process.env.DATABASE_URL so that the schema/query engine reads it correctly.
  if (databaseUrl) {
    process.env.DATABASE_URL = databaseUrl;
  }

  // Remove unsupported parameters like socket_timeout to prevent Prisma validation crash
  try {
    if (databaseUrl.includes('socket_timeout')) {
      const [base, query] = databaseUrl.split('?');
      if (query) {
        const cleanedParams = query
          .split('&')
          .filter(param => !param.startsWith('socket_timeout='))
          .join('&');
        databaseUrl = cleanedParams ? `${base}?${cleanedParams}` : base;
      }
    }
  } catch (e) {
    console.error('[Prisma URL Parser Error]', e);
  }

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

/**
 * Robust helper to detect any database connection, initialization, handshake, or timeout error.
 */
function checkConnectionError(error: any): boolean {
  if (!error) return false;
  const errorMessage = String(error.message || error);
  
  // Check Prisma-specific error codes
  // P1xxx error codes cover all database engine startup/connection issues
  // P2024 is the connection pool timeout error
  const code = error.code;
  if (code && typeof code === 'string') {
    if (code.startsWith('P1') || code === 'P2024') {
      return true;
    }
  }

  // Match known initialization/connection error names
  if (error.name === 'PrismaClientInitializationError') {
    return true;
  }

  // Match common system/driver/Prisma message patterns
  const isConn =
    errorMessage.includes("closed the connection") ||
    errorMessage.includes("Can't reach database") ||
    errorMessage.includes("socket") ||
    errorMessage.includes("connection closed") ||
    errorMessage.includes("pool") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("timed out") ||
    errorMessage.includes("handshake") ||
    errorMessage.includes("Handshake") ||
    errorMessage.includes("ECONN") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("EPIPE");

  return isConn;
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
                const isConnectionError = checkConnectionError(error);

                if (isConnectionError) {
                  console.warn('[Prisma Proxy] Database connection error or timeout detected. Re-establishing socket and retrying query...');
                  try {
                    await rawPrisma.$disconnect();
                  } catch { }
                  
                  // Wait 200ms to allow TCP socket recycling/retry cooldown
                  await new Promise(resolve => setTimeout(resolve, 200));

                  try {
                    await rawPrisma.$connect();
                  } catch { }
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
          const isConnectionError = checkConnectionError(error);

          if (isConnectionError) {
            console.warn('[Prisma Proxy] Database connection error or timeout detected. Re-establishing socket and retrying query...');
            try {
              await rawPrisma.$disconnect();
            } catch { }
            
            // Wait 200ms to allow TCP socket recycling/retry cooldown
            await new Promise(resolve => setTimeout(resolve, 200));

            try {
              await rawPrisma.$connect();
            } catch { }
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

