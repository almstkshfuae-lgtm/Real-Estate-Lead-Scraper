import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getKey() {
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
 * @param {string} text
 * @returns {string} Encrypted string in format ivHex:encryptedHex
 */
export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts an encrypted string. If string is not encrypted (does not contain ':'),
 * it returns the string as-is for backwards compatibility with legacy plaintext entries.
 *
 * @param {string} encryptedText
 * @returns {string} Decrypted string
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }
  try {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    if (!ivHex || !encryptedHex || ivHex.length !== 32) {
      return encryptedText; // Legacy or invalid format
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedText; // Fallback to raw value on error
  }
}

/**
 * Encrypts a JSON object or array to a string.
 *
 * @param {any} data
 * @returns {any} Encrypted string
 */
export function encryptJson(data) {
  if (!data) return data;
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  return encrypt(jsonStr);
}

/**
 * Decrypts an encrypted string back to a JSON object or array.
 * If data is already an object/array, returns it as-is for backward compatibility.
 *
 * @param {any} data
 * @returns {any} Decrypted object/array
 */
export function decryptJson(data) {
  if (!data) return data;
  if (typeof data !== 'string') {
    return data; // Already an object or array (legacy plaintext)
  }
  if (!data.includes(':')) {
    // String, but not in our iv:encrypted format (e.g. raw JSON stored as string)
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  }
  try {
    const decryptedStr = decrypt(data);
    return JSON.parse(decryptedStr);
  } catch (err) {
    console.error('[decryptJson] Failed to decrypt JSON string:', err);
    return data;
  }
}
