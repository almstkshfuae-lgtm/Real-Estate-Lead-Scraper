import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createToken } from '@/lib/auth';

// Simple in-memory rate limiter state
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 mins
let lastCleanup = Date.now();

function checkRateLimit(key: string): { allowed: boolean; waitTimeRemainingMs: number } {
  // Periodically clean up expired entries
  if (Date.now() - lastCleanup > CLEANUP_INTERVAL) {
    for (const [k, value] of loginAttempts.entries()) {
      if (Date.now() > value.blockedUntil) {
        loginAttempts.delete(k);
      }
    }
    lastCleanup = Date.now();
  }

  const record = loginAttempts.get(key);
  if (!record) {
    return { allowed: true, waitTimeRemainingMs: 0 };
  }

  if (Date.now() < record.blockedUntil) {
    return { allowed: false, waitTimeRemainingMs: record.blockedUntil - Date.now() };
  }

  // If block time has expired, reset count
  if (Date.now() >= record.blockedUntil && record.blockedUntil > 0) {
    loginAttempts.delete(key);
  }

  return { allowed: true, waitTimeRemainingMs: 0 };
}

function recordFailure(key: string, limit = 5, blockDurationMs = 15 * 60 * 1000) {
  const record = loginAttempts.get(key) || { count: 0, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= limit) {
    record.blockedUntil = Date.now() + blockDurationMs;
  }
  loginAttempts.set(key, record);
}

function recordSuccess(key: string) {
  loginAttempts.delete(key);
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Resolve client IP address safely
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || 
               request.headers.get("x-real-ip")?.trim() || 
               "127.0.0.1";

    const normalizedEmail = email.trim().toLowerCase();

    // Check rate limits
    const ipLimit = checkRateLimit(ip);
    if (!ipLimit.allowed) {
      const mins = Math.ceil(ipLimit.waitTimeRemainingMs / 60000);
      return NextResponse.json(
        { error: `Too many failed login attempts from this IP. Please try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    const emailLimit = checkRateLimit(normalizedEmail);
    if (!emailLimit.allowed) {
      const mins = Math.ceil(emailLimit.waitTimeRemainingMs / 60000);
      return NextResponse.json(
        { error: `Too many failed login attempts for this email. Please try again in ${mins} minute(s).` },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      recordFailure(ip);
      recordFailure(normalizedEmail);
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Reset attempts on successful login
    recordSuccess(ip);
    recordSuccess(normalizedEmail);

    const token = await createToken({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      nameAr: user.nameAr,
      language: user.language,
      theme: user.theme,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          language: user.language,
          theme: user.theme,
        },
        token: token,
      },
      { status: 200 }
    );

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    response.cookies.set('i18next', user.language, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
