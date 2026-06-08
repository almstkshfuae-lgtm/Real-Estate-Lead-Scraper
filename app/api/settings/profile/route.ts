import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createToken, getSessionWithDBVerify } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        name: true,
        email: true,
        language: true,
        theme: true,
        role: true,
      },
    });

    if (!user) {
      console.error(`[Profile GET] User not found in DB. Session ID from JWT: "${session.id}" | Email: "${session.id}" — JWT may be stale (DB was reset or user was deleted).`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch profile error:', error?.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionWithDBVerify();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, language, theme, currentPassword, newPassword } = await request.json();

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanLanguage = typeof language === 'string' ? language.trim() : '';
    const cleanTheme = typeof theme === 'string' ? theme.trim() : '';

    if (!cleanName || !cleanEmail || !cleanLanguage || !cleanTheme) {
      return NextResponse.json({ error: 'Missing profile fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        id: { not: session.id },
      },
    });
    if (existingUser) {
      return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    const updateData: any = {
      name: cleanName,
      email: cleanEmail,
      language: cleanLanguage,
      theme: cleanTheme,
    };

    const cleanNewPassword = typeof newPassword === 'string' ? newPassword.trim() : '';
    const cleanCurrentPassword = typeof currentPassword === 'string' ? currentPassword.trim() : '';

    if (cleanNewPassword) {
      if (!cleanCurrentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password' }, { status: 400 });
      }

      if (cleanNewPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!(await bcrypt.compare(cleanCurrentPassword, user.passwordHash))) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      updateData.passwordHash = await bcrypt.hash(cleanNewPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        nameAr: true,
        language: true,
        theme: true,
        role: true,
      },
    });

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
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    response.cookies.set('i18next', updatedUser.language, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Update profile error:', error?.message || error);

    if (error?.code === 'P2002' && error?.meta?.target?.includes('email')) {
      return NextResponse.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
