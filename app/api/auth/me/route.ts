import { NextRequest, NextResponse } from 'next/server';
import { getSession, shouldRefreshAndCreateNewToken } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const payload = await getSession();

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name || 'Agent',
      nameAr: payload.nameAr || payload.name || 'وكيل',
    },
  });

  // Handle sliding session token extension
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;

  if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    const refreshedToken = await shouldRefreshAndCreateNewToken(token);
    if (refreshedToken) {
      console.info('[auth/me] Extending active session for user:', payload.email);
      response.cookies.set('auth_token', refreshedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
    }
  }

  return response;
}
