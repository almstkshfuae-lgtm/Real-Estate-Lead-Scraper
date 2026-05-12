import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/bitrix24';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const domain = searchParams.get('domain');

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  // In a real app, we would exchange the code and save the tokens to the DB
  // for the specific user/company.
  
  // const session = await exchangeCode(code);
  
  return NextResponse.redirect(new URL('/settings/integrations?success=bitrix', request.url));
}
