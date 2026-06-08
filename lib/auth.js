import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import prisma from './prisma';
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
        if (process.env.NODE_ENV === 'production') {
            const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || process.env.CI === 'true';
            if (isBuildPhase) {
                return 'temp-build-secret-key';
            }
            throw new Error("FATAL: JWT_SECRET environment variable is missing in production!");
        }
        return 'dev-secret-key-change-in-production';
    }
    return secret;
}
export async function createToken(user) {
    return jwt.sign(user, getJwtSecret(), { expiresIn: '7d' });
}
export async function verifyToken(token) {
    try {
        return jwt.verify(token, getJwtSecret());
    }
    catch (error) {
        // Log the verification error for debugging (do not log the token)
        try {
            console.warn('[verifyToken] token verification failed:', error.message);
        }
        catch { }
        return null;
    }
}
export function parsePreferences(preferences) {
    if (!preferences)
        return {};
    if (typeof preferences === 'string') {
        try {
            return JSON.parse(preferences);
        }
        catch {
            return {};
        }
    }
    return preferences;
}
export function normalizePreferences(preferences) {
    if (typeof preferences === 'string')
        return preferences;
    return JSON.stringify(preferences || {});
}
/**
 * STATELESS JWT SESSION (Primary — used on every API request)
 *
 * Performance fix: This function no longer touches the database.
 * The JWT is cryptographically signed with JWT_SECRET, so it is
 * tamper-proof. The payload already contains id, email, and role —
 * everything needed for RBAC — without a DB round-trip.
 *
 * Previously, every API call hit prisma.user.findUnique() which,
 * under 8 concurrent requests, produced 8 competing DB connections
 * just for authentication — exhausting Railway's connection pool
 * before any business logic ran.
 *
 * Security note: Tokens expire in 7 days. To invalidate a specific
 * token early (e.g. password change, ban), use getSessionWithDBVerify()
 * in the specific routes that require it.
 */
export async function getSession() {
    var _a;
    const cookieStore = await cookies();
    let token = (_a = cookieStore.get('auth_token')) === null || _a === void 0 ? void 0 : _a.value;
    if (!token) {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');
        if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token)
        return null;
    const decoded = await verifyToken(token);
    if (!decoded)
        return null;
    // Stateless: trust the cryptographically verified JWT payload directly.
    // No DB query. No connection consumed.
    return decoded;
}
/**
 * DB-VERIFIED SESSION (Use only when you MUST confirm the user still exists
 * and their role hasn't changed — e.g. admin user-management routes, or
 * after a password/role change operation.)
 *
 * Do NOT use this in high-traffic read routes like /api/leads or /api/notifications.
 */
export async function getSessionWithDBVerify() {
    var _a;
    const cookieStore = await cookies();
    let token = (_a = cookieStore.get('auth_token')) === null || _a === void 0 ? void 0 : _a.value;
    if (!token) {
        const headersList = await headers();
        const authHeader = headersList.get('Authorization');
        if (authHeader === null || authHeader === void 0 ? void 0 : authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token)
        return null;
    const decoded = await verifyToken(token);
    if (!decoded)
        return null;
    try {
        const userPromise = prisma.user.findUnique({
            where: { id: decoded.id },
            select: { email: true, role: true },
        });
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Session DB check timed out')), 10000));
        const user = await Promise.race([userPromise, timeoutPromise]);
        if (!user || user.email !== decoded.email || user.role !== decoded.role) {
            return null;
        }
    }
    catch (error) {
        console.error('[getSessionWithDBVerify] DB check failed or timed out, denying access:', error);
        return null; // Fail-secure: Deny authentication if DB check fails/times out
    }
    return decoded;
}
export async function setSession(token) {
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
    });
}
export async function removeSession() {
    const cookieStore = await cookies();
    cookieStore.delete('auth_token');
}
