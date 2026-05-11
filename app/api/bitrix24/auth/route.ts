import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/bitrix';

export async function GET() {
  try {
    const url = await getAuthUrl();
    return NextResponse.redirect(url);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
