import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
};

export async function createToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (error) {
    // Log the verification error for debugging (do not log the token)
    try {
      console.warn('[verifyToken] token verification failed:', (error as Error).message);
    } catch {}
    return null;
  }
}

export function parsePreferences(preferences: any) {
  if (!preferences) return {};
  if (typeof preferences === 'string') {
    try {
      return JSON.parse(preferences);
    } catch {
      return {};
    }
  }
  return preferences;
}

export function normalizePreferences(preferences: any) {
  if (typeof preferences === 'string') return preferences;
  return JSON.stringify(preferences || {});
}

export async function getSession(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;
  
  if (!token) {
    const headersList = await headers();
    const authHeader = headersList.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  
  if (!token) return null;
  const decoded = await verifyToken(token);
  if (!decoded) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { email: true, role: true },
    });
    if (!user || user.email !== decoded.email || user.role !== decoded.role) {
      return null;
    }
  } catch (error) {
    console.warn('[getSession] DB check failed, falling back to stateless session verification:', error);
  }

  return decoded;
}

export async function setSession(token: string) {
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
