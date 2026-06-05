import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    // 1. Allow public routes to bypass authentication completely
    // We only permit /api/auth/login to be public. Other paths like /api/auth/me are secure.
    if (
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname === '/api/auth/login' ||
      pathname === '/api/scrape/webhook' ||
      pathname === '/api/cron/scrape' ||
      pathname === '/install' ||
      pathname.startsWith('/_next') ||
      pathname.includes('.') ||
      pathname.startsWith('/.well-known')
    ) {
      return NextResponse.next();
    }

    // 2. Extract and verify session token (supports both Cookies and Authorization Header)
    let token = request.cookies.get('auth_token')?.value;
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    let user = null;
    if (token) {
      user = await verifyToken(token);
    }

    // 3. Handle unauthenticated requests uniformly based on content type
    if (!user) {
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
  } catch (err: any) {
    console.error('Boundary authorization proxy handler crashed:', err);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Internal authorization boundary error.' },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
}

// 4. Hardened Next.js 16 Matcher Config: Actively protect both UI layouts and API routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)',
  ],
};
