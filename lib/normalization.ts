/**
 * Text normalization utilities for lead deduplication.
 * Prevents minor spelling/character variations from creating duplicate leads.
 *
 * Handles:
 * - English: lowercase, trim, collapse whitespace
 * - Arabic: normalize Alif variants (أ إ آ ٱ → ا), Ta Marbouta/Haa (ه → ة at word end),
 *           Alif Maqsoora/Yaa (ى → ي at word end)
 */

/**
 * Normalize a single text string for duplicate detection.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  let norm = text.trim().toLowerCase().replace(/\s+/g, " ");

  // Arabic: normalize Alif variants → bare Alif (ا)
  norm = norm.replace(/[أإآٱ]/g, "ا");

  // Arabic: normalize Ta Marbouta (ة) and trailing Haa (ه) at word end → ة
  norm = norm.replace(/ه(?=\s|$)/g, "ة");

  // Arabic: normalize Alif Maqsoora (ى) at word end → Yaa (ي)
  norm = norm.replace(/ى(?=\s|$)/g, "ي");

  return norm;
}

/**
 * Build a normalized deduplication key from name + company.
 * Used as the primary dedup identifier when phone/email are unavailable.
 */
export function buildDedupeKey(name: string, company: string): string {
  return `${normalizeText(name)}|${normalizeText(company)}`;
}

/**
 * Normalize a phone number for deduplication (strip spaces, dashes, plus).
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/[\s\-().+]/g, "").toLowerCase();
}

/**
 * Normalize an email for deduplication.
 */
export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Generate spelling variants of a name to include in DB search queries.
 * Handles Alif variants at start, and Ta Marbouta/Haa / Yaa/Alif Maqsoora at the end.
 */
export function getNameVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  
  let variants = [trimmed];

  // 1. Starting Alif variants (أ / إ / آ / ا)
  const alifVariants: string[] = [];
  for (const v of variants) {
    if (/^[أإآا]/.test(v)) {
      const rest = v.slice(1);
      alifVariants.push("أ" + rest, "إ" + rest, "آ" + rest, "ا" + rest);
    } else {
      alifVariants.push(v);
    }
  }
  variants = [...new Set(alifVariants)];

  // 2. Ending Ta Marbouta / Haa variants (ة / ه)
  const tmVariants: string[] = [];
  for (const v of variants) {
    if (v.endsWith("ة") || v.endsWith("ه")) {
      const base = v.slice(0, -1);
      tmVariants.push(base + "ة", base + "ه");
    } else {
      tmVariants.push(v);
    }
  }
  variants = [...new Set(tmVariants)];

  // 3. Ending Yaa / Alif Maqsoora variants (ي / ى)
  const yaVariants: string[] = [];
  for (const v of variants) {
    if (v.endsWith("ي") || v.endsWith("ى")) {
      const base = v.slice(0, -1);
      yaVariants.push(base + "ي", base + "ى");
    } else {
      yaVariants.push(v);
    }
  }
  
  return [...new Set(yaVariants)];
}

