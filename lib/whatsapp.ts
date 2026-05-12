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
  const sanitizedTo = to.replace(/\D/g, '');

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

  const sanitizedTo = to.replace(/\D/g, '');
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
    const url = `https://graph.facebook.com/v17.0/${phoneId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}
