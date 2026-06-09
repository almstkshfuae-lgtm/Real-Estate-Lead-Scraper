import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey(): Buffer {
  const secret = process.env.SCRAPER_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error("FATAL: SCRAPER_SECRET is missing. Cannot initialize cryptography in production!");
    }
    return crypto.createHash('sha256').update('96c92e16c2bc5f40c5724ad3bceef2fa39909e4bb136656d4a8309984f828684').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string.
 *
 * @param text The text to encrypt
 * @returns The encrypted text in format ivHex:encryptedHex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string. If string is not encrypted (does not contain ':'),
 * it returns the string as-is for backwards compatibility.
 *
 * @param encryptedText The encrypted text (or legacy plaintext)
 * @returns The decrypted text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex || ivHex.length !== 32) {
      return encryptedText;
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText;
  }
}
