import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createToken, getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, email, language, theme, currentPassword, newPassword } = await request.json();

    if (!name || !email || !language || !theme) {
      return NextResponse.json({ error: 'Missing profile fields' }, { status: 400 });
    }

    const updateData: any = {
      name,
      email,
      language,
      theme,
    };

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password is required to change password' }, { status: 400 });
      }

      const user = await prisma.user.findUnique({ where: { id: session.id } });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        theme: true,
        role: true,
      },
    });

    const token = await createToken({
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const response = NextResponse.json({ success: true, user: updatedUser }, { status: 200 });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
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
