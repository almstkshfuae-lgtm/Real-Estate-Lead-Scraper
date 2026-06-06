/**
 * WhatsApp Business API Client
 * 
 * Supports sending templated messages to leads using WhatsApp Cloud API.
 * 
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export interface WhatsAppMessageParams {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

/**
 * Sends a WhatsApp templated message to a lead
 */
export async function sendWhatsAppMessage(
  phoneId: string,
  token: string,
  to: string,
  templateName: string,
  languageCode: string = "en",
  components: any[] = []
) {
  if (!phoneId || !token) {
    throw new Error('WhatsApp configuration missing');
  }

  // Sanitize phone number (must be in international format without + or leading zeros)
  const sanitizedTo = sanitizeUAENumber(to);

  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

  const body: WhatsAppMessageParams = {
    messaging_product: "whatsapp",
    to: sanitizedTo,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      ...(components.length > 0 && { components })
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `WhatsApp error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Sends a simple text message (requires 24h window or existing session)
 */
export async function sendWhatsAppText(
  phoneId: string,
  token: string,
  to: string,
  text: string
) {
  if (!phoneId || !token) {
    throw new Error('WhatsApp configuration missing');
  }

  const sanitizedTo = sanitizeUAENumber(to);
  const url = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

  const body = {
    messaging_product: "whatsapp",
    to: sanitizedTo,
    type: "text",
    text: { body: text }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `WhatsApp error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Tests the WhatsApp connection by checking the phone ID status
 */
export async function testWhatsAppConnection(phoneId: string, token: string) {
  try {
    // Verify the WhatsApp Business Profile is configured (not just that the phoneId exists)
    const url = `https://graph.facebook.com/v17.0/${phoneId}/whatsapp_business_profile`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return false;
    const data = await response.json();
    // Confirm the profile data exists — this validates messaging is properly configured
    return Array.isArray(data?.data) && data.data.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Sanitizes and normalizes phone numbers specifically for UAE local and international formats
 */
export function sanitizeUAENumber(phone: string): string {
  // Strip all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If it starts with 00, strip the leading 00 to support general international numbers (e.g., 00966... -> 966...)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  // Otherwise, handle local UAE numbers
  // If it starts with a leading 0 followed by 5 (e.g., 050, 052, 054, 055, 056, 058), replace leading 0 with 971
  else if (cleaned.startsWith('05') && cleaned.length === 10) {
    cleaned = '971' + cleaned.substring(1);
  }
  // If it starts with 5 (e.g., 50, 52, 54, 55, 56, 58) and has length of 9, prepend 971
  else if (cleaned.startsWith('5') && cleaned.length === 9) {
    cleaned = '971' + cleaned;
  }

  return cleaned;
}
