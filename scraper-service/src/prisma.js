import { PrismaClient } from '@prisma/client';

let databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || '';
if (databaseUrl) {
  databaseUrl = databaseUrl.trim().replace(/^['"]|['"]$/g, '').trim();
}

// Clean socket_timeout parameter to prevent Prisma engine issues
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
  console.error('[Prisma URL Parser Error in Scraper]', e);
}

// Enforce a small connection limit (e.g. 3) to prevent pool exhaustion on Railway
try {
  if (databaseUrl) {
    const [base, query] = databaseUrl.split('?');
    let params = [];
    let hasConnectionLimit = false;

    if (query) {
      params = query.split('&').map(param => {
        if (param.startsWith('connection_limit=')) {
          hasConnectionLimit = true;
          return 'connection_limit=3'; // Override/force limit of 3
        }
        return param;
      });
    }

    if (!hasConnectionLimit) {
      params.push('connection_limit=3');
    }

    databaseUrl = `${base}?${params.join('&')}`;
  }
} catch (e) {
  console.error('[Prisma Connection Limit Parser Error]', e);
}

const rawPrisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'minimal',
});

// Resiliency Proxy with reconnect logic (similar to Next.js lib/prisma.ts)
function checkConnectionError(error) {
  if (!error) return false;
  const errorMessage = String(error.message || error);
  const code = error.code;
  if (code && typeof code === 'string') {
    if (code.startsWith('P1') || code === 'P2024') {
      return true;
    }
  }
  if (error.name === 'PrismaClientInitializationError') {
    return true;
  }
  return errorMessage.includes("closed the connection") ||
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
    errorMessage.includes("EPIPE") ||
    errorMessage.includes("Connection reset by peer");
}

let reconnectLock = null;
let reconnectAttempts = 0;

async function reconnectWithBackoff(attempt = 0) {
  const base = Math.min(100 * Math.pow(2, attempt), 1000);
  const jitter = Math.random() * 100;
  const delay = base + jitter;

  console.warn(`[Prisma Scraper Proxy] Connection dropped. Reconnecting in ${Math.round(delay)}ms...`);
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    await rawPrisma.$disconnect();
  } catch {}

  try {
    await rawPrisma.$connect();
    console.log('[Prisma Scraper Proxy] Reconnect successful.');
    reconnectAttempts = 0;
  } catch (err) {
    console.error('[Prisma Scraper Proxy] Reconnect failed:', err.message);
    reconnectAttempts++;
  }
}

const proxyCache = new WeakMap();
const topLevelMethodCache = new Map();

export const prisma = new Proxy(rawPrisma, {
  get(target, prop, receiver) {
    if (prop === '$raw') {
      return rawPrisma;
    }
    const value = Reflect.get(target, prop, receiver);

    if (value && typeof value === 'object' && !('then' in value)) {
      let cachedProxy = proxyCache.get(value);
      if (!cachedProxy) {
        const modelMethodCache = new Map();
        cachedProxy = new Proxy(value, {
          get(modelTarget, modelProp) {
            const method = Reflect.get(modelTarget, modelProp);
            if (typeof method === 'function') {
              let cachedMethod = modelMethodCache.get(modelProp);
              if (!cachedMethod) {
                cachedMethod = async function (...args) {
                  try {
                    const currentMethod = Reflect.get(modelTarget, modelProp);
                    const res = await currentMethod.apply(modelTarget, args);
                    reconnectAttempts = 0;
                    return res;
                  } catch (error) {
                    if (!checkConnectionError(error)) {
                      throw error;
                    }
                    console.warn('[Prisma Scraper Proxy] Connection error detected. Reconnecting...');
                    if (!reconnectLock) {
                      reconnectLock = reconnectWithBackoff(reconnectAttempts).finally(() => {
                        reconnectLock = null;
                      });
                    }
                    await reconnectLock;
                    const currentMethodAfterReconnect = Reflect.get(modelTarget, modelProp);
                    const retryRes = await currentMethodAfterReconnect.apply(modelTarget, args);
                    reconnectAttempts = 0;
                    return retryRes;
                  }
                };
                modelMethodCache.set(modelProp, cachedMethod);
              }
              return cachedMethod;
            }
            return method;
          }
        });
        proxyCache.set(value, cachedProxy);
      }
      return cachedProxy;
    }

    if (typeof value === 'function') {
      let cachedMethod = topLevelMethodCache.get(prop);
      if (!cachedMethod) {
        cachedMethod = async function (...args) {
          try {
            const currentMethod = Reflect.get(target, prop);
            const res = await currentMethod.apply(target, args);
            reconnectAttempts = 0;
            return res;
          } catch (error) {
            if (!checkConnectionError(error)) {
              throw error;
            }
            console.warn('[Prisma Scraper Proxy] Connection error detected on top-level method. Reconnecting...');
            if (!reconnectLock) {
              reconnectLock = reconnectWithBackoff(reconnectAttempts).finally(() => {
                reconnectLock = null;
              });
            }
            await reconnectLock;
            const currentMethodAfterReconnect = Reflect.get(target, prop);
            const retryRes = await currentMethodAfterReconnect.apply(target, args);
            reconnectAttempts = 0;
            return retryRes;
          }
        };
        topLevelMethodCache.set(prop, cachedMethod);
      }
      return cachedMethod;
    }

    return value;
  }
});

export default prisma;
