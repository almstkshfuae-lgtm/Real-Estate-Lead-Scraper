import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow all public routes to bypass authentication completely
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/install' ||
    pathname.startsWith('/_next') ||
    pathname.includes('.') ||
    pathname.startsWith('/.well-known')
  ) {
    return NextResponse.next();
  }

  // 2. Extract and verify session token
  const token = request.cookies.get('auth_token')?.value;
  let user = null;

  try {
    user = token ? await verifyToken(token) : null;
  } catch (err) {
    console.error('Boundary authorization token verification failed:', err);
    // Continue with user = null so fallback enforcement blocks the request safely
  }

  // 3. Handle unauthenticated requests uniformly based on content type
  if (!user) {
    // If the request is an API call, ALWAYS return clean, parseable JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Session expired or invalid. Please log in again.' },
        { status: 401 }
      );
    }

    // If it's a browser page request, redirect safely to the login screen
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = ''; // Wipe search params to guarantee no redirect loops
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// 4. Hardened Next.js 16 Matcher Config: Actively protect both UI layouts and API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
  ],
};
