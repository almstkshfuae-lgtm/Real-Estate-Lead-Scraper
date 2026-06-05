import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Fetch name and nameAr dynamically from DB
  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { name: true, nameAr: true }
  });

  return NextResponse.json({
    user: {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: dbUser?.name || 'Agent',
      nameAr: dbUser?.nameAr || dbUser?.name || 'وكيل',
    },
  });
}
