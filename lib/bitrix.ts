export interface BitrixSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  domain: string;
}

export async function getAuthUrl() {
  const clientId = process.env.BITRIX24_CLIENT_ID;
  const redirectUri = process.env.BITRIX24_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('Bitrix24 credentials missing');
  }

  // Bitrix24 uses a domain-specific OAuth URL or a general one
  // For local dev, we might need a placeholder or a real domain if provided
  return `https://oauth.bitrix.info/oauth/authorize/?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function exchangeCode(code: string) {
  const clientId = process.env.BITRIX24_CLIENT_ID;
  const clientSecret = process.env.BITRIX24_CLIENT_SECRET;
  
  const res = await fetch(`https://oauth.bitrix.info/oauth/token/`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    // In real Bitrix flow, these are usually query params or form data
  });

  return res.json();
}
