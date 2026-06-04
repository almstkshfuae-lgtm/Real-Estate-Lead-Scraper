export function getEnvVar(key: string, fallback: string = ''): string {
  const normalized = key.toUpperCase();
  const candidates = [
    process.env[normalized],
    process.env[`NEXT_PUBLIC_${normalized}`],
    process.env[`VERCEL_${normalized}`],
    process.env[`NEXT_PUBLIC_VERCEL_${normalized}`]
  ];
  for (const value of candidates) {
    if (value) {
      let cleaned = value.trim();
      // Strip surrounding quotes
      cleaned = cleaned.replace(/^['"]|['"]$/g, '').trim();
      if (cleaned !== '' && cleaned !== '""' && cleaned !== "''" && !cleaned.startsWith('YOUR_')) {
        return cleaned;
      }
    }
  }
  return fallback;
}

export function getRequiredEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
