export function getEnvVar(key: string, fallback: string = ''): string {
  const normalized = key.toUpperCase();
  const candidates = [
    process.env[normalized],
    process.env[`NEXT_PUBLIC_${normalized}`],
    process.env[`VERCEL_${normalized}`],
    process.env[`NEXT_PUBLIC_VERCEL_${normalized}`]
  ];
  for (const value of candidates) {
    if (value && value.trim() !== '') {
      return value;
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
