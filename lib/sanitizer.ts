/**
 * Clean and normalise a phone string specifically for UAE and general formats; returns null if invalid.
 */
export function cleanPhone(raw: string): string | null {
  if (!raw) return null;
  
  // Strip all non-digit and non-plus characters
  let cleaned = raw.replace(/[^\d+]/g, "");
  
  // If there are multiple plus signs, keep only the first one
  if (cleaned.startsWith("+")) {
    cleaned = "+" + cleaned.replace(/\+/g, "");
  } else {
    cleaned = cleaned.replace(/\+/g, "");
  }
  
  // Replace leading 00 with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.substring(2);
  }
  
  // If it doesn't start with +, add standard country code normalization
  if (!cleaned.startsWith("+")) {
    // If it starts with a leading 0 followed by 5 (e.g., 050, 052) and length is 10:
    if (cleaned.startsWith("05") && cleaned.length === 10) {
      cleaned = "+971" + cleaned.substring(1);
    }
    // If it starts with 5 and has length of 9 (e.g., 507778888):
    else if (cleaned.startsWith("5") && cleaned.length === 9) {
      cleaned = "+971" + cleaned;
    }
    // If it starts with 971 and has length of 12 (e.g., 971507778888):
    else if (cleaned.startsWith("971") && cleaned.length === 12) {
      cleaned = "+" + cleaned;
    }
    // If it is already in international format but missing + (e.g., 966..., 1...):
    else if (cleaned.length >= 7) {
      cleaned = "+" + cleaned;
    }
  }

  // Must have between 7 and 15 digits to be a valid phone number (ITU-T E.164 standard)
  const digitCount = cleaned.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return null;
  
  return cleaned;
}

/**
 * Clean and robustly validate an email string; returns null if invalid or placeholder.
 */
export function cleanEmail(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  
  // Exclude placeholder or invalid emails
  if (
    cleaned === "" || 
    cleaned.includes("noemail") || 
    cleaned.includes("notavailable") || 
    cleaned.includes("none") || 
    cleaned.includes("n/a") ||
    cleaned.includes("example.com")
  ) {
    return null;
  }
  
  // Extract email matching standard format
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = cleaned.match(emailRegex);
  return match ? match[0] : null;
}
