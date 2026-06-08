import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createToken, getSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { language } = await request.json();
    if (language !== 'en' && language !== 'ar') {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    // Update the user record in the database
    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: { language },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        nameAr: true,
        language: true,
        theme: true,
      },
    });

    // Create a new JWT token with updated language in the payload
    const token = await createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      name: updatedUser.name,
      nameAr: updatedUser.nameAr,
      language: updatedUser.language,
      theme: updatedUser.theme,
    });

    const response = NextResponse.json({ success: true, user: updatedUser }, { status: 200 });

    const cookieStore = await cookies();

    // Refresh auth_token cookie
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Set i18next cookie
    cookieStore.set('i18next', language, {
      httpOnly: false, // accessible to browser LanguageDetector
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Update language preference error:', error?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
