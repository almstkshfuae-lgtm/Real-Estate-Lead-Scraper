import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes
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

  // Protected routes
  const token = request.cookies.get('auth_token')?.value;
  const user = token ? await verifyToken(token) : null;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // Clear search params to avoid redirect loops or weird state
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Config is still used for matching
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (api routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
