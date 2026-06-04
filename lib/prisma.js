var _a;
import { PrismaClient } from '@prisma/client';
const prismaClientSingleton = () => {
    var _a;
    // Ensure that if process.env.DATABASE_URL is empty, whitespace, or empty quotes, we delete it to allow proper fallback
    let rawUrl = (_a = process.env.DATABASE_URL) === null || _a === void 0 ? void 0 : _a.trim();
    if (rawUrl) {
        rawUrl = rawUrl.replace(/^['"]|['"]$/g, '').trim();
    }
    if (!rawUrl || rawUrl === '' || rawUrl === '""' || rawUrl === "''" || rawUrl.startsWith('YOUR_')) {
        delete process.env.DATABASE_URL;
    }
    let databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || '';
    // Strip any surrounding double or single quotes
    if (databaseUrl) {
        databaseUrl = databaseUrl.trim().replace(/^['"]|['"]$/g, '').trim();
    }
    // Re-assign the correct fallback url to process.env.DATABASE_URL so that the schema/query engine reads it correctly.
    if (databaseUrl && databaseUrl !== '""' && databaseUrl !== "''") {
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
    }
    catch (e) {
        console.error('[Prisma URL Parser Error]', e);
    }
    const client = new PrismaClient({
        datasources: {
            db: {
                url: databaseUrl,
            },
        },
        // Minimal logs in production to reduce noise; full logs in dev
        log: process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
        errorFormat: 'minimal',
    });
    return client;
};
const rawPrisma = (_a = globalThis.prisma) !== null && _a !== void 0 ? _a : prismaClientSingleton();
// In development, reuse across HMR reloads to avoid connection-pool exhaustion.
if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = rawPrisma;
}
/**
 * Robust helper to detect any database connection, initialization, handshake, or timeout error.
 */
function checkConnectionError(error) {
    if (!error)
        return false;
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
    const isConn = errorMessage.includes("closed the connection") ||
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
        errorMessage.includes("P2024") ||
        errorMessage.includes("P1001") ||
        errorMessage.includes("P1011") ||
        errorMessage.includes("P1008") ||
        errorMessage.includes("Connection reset by peer");
    return isConn;
}
/**
 * GLOBAL RECONNECT LOCK
 *
 * Critical fix for the "Concurrent Reconnect Storm" problem:
 * When 8 simultaneous requests all hit a connection error, the old proxy
 * would spawn 8 independent reconnect cycles, each calling $disconnect() +
 * $connect() at the same time, which multiplied the connection pressure on
 * Railway's proxy instead of reducing it.
 *
 * With this lock, only ONE reconnect attempt runs at a time. All other
 * concurrent callers wait for the single shared reconnect Promise to settle
 * before they retry their original query.
 */
let reconnectLock = null;
async function reconnectWithBackoff(attempt = 0) {
    // Exponential backoff: 100ms, 200ms, 400ms... capped at 1000ms + random jitter
    const base = Math.min(100 * Math.pow(2, attempt), 1000);
    const jitter = Math.random() * 100;
    const delay = base + jitter;
    console.warn(`[Prisma Proxy] Reconnect attempt ${attempt + 1}: waiting ${Math.round(delay)}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    try {
        await rawPrisma.$disconnect();
    }
    catch {
        // Ignore disconnect errors — we're already in a broken state
    }
    try {
        await rawPrisma.$connect();
        console.warn('[Prisma Proxy] Reconnect successful.');
    }
    catch (reconnectError) {
        console.error('[Prisma Proxy] Reconnect failed:', reconnectError);
        // Do not throw — let the caller's retry handle the next failure
    }
}
// 100% Resilient Prisma Connection Proxy
// Single-retry policy with global reconnect lock to prevent thundering herd
// against Railway's TCP proxy under concurrent serverless load.
export const prisma = new Proxy(rawPrisma, {
    get(target, prop, receiver) {
        if (prop === '$raw') {
            return rawPrisma;
        }
        const value = Reflect.get(target, prop, receiver);
        // If it's a Prisma model (e.g. user, lead, chatMessage) or a relation namespace
        if (value && typeof value === 'object' && !('then' in value)) {
            return new Proxy(value, {
                get(modelTarget, modelProp) {
                    const method = Reflect.get(modelTarget, modelProp);
                    if (typeof method === 'function') {
                        return async function (...args) {
                            try {
                                return await method.apply(modelTarget, args);
                            }
                            catch (error) {
                                if (!checkConnectionError(error)) {
                                    throw error;
                                }
                                console.warn('[Prisma Proxy] Connection error detected on model method. Acquiring reconnect lock...');
                                // If no reconnect is in progress, start one. Otherwise, reuse the existing Promise.
                                if (!reconnectLock) {
                                    reconnectLock = reconnectWithBackoff(0).finally(() => {
                                        reconnectLock = null;
                                    });
                                }
                                // All concurrent callers wait for the single shared reconnect to complete
                                await reconnectLock;
                                // Single retry after reconnect
                                return await method.apply(modelTarget, args);
                            }
                        };
                    }
                    return method;
                }
            });
        }
        if (typeof value === 'function') {
            return async function (...args) {
                try {
                    return await value.apply(target, args);
                }
                catch (error) {
                    if (!checkConnectionError(error)) {
                        throw error;
                    }
                    console.warn('[Prisma Proxy] Connection error detected on top-level method. Acquiring reconnect lock...');
                    if (!reconnectLock) {
                        reconnectLock = reconnectWithBackoff(0).finally(() => {
                            reconnectLock = null;
                        });
                    }
                    await reconnectLock;
                    return await value.apply(target, args);
                }
            };
        }
        return value;
    }
});
export default prisma;
