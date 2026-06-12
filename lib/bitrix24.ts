/**
 * Bitrix24 CRM Integration Library
 * 
 * Supports both Webhook and OAuth authentication for pushing leads to Bitrix24.
 * 
 * Reference: https://training.bitrix24.com/rest_help/crm/contacts/crm_contact_add.php
 */

export interface BitrixSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  domain: string;
}

export interface BitrixContactParams {
  NAME: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  PHONE?: { VALUE: string; VALUE_TYPE: 'WORK' | 'MOBILE' | 'HOME' | 'OTHER' }[];
  EMAIL?: { VALUE: string; VALUE_TYPE: 'WORK' | 'MAILING' | 'HOME' | 'OTHER' }[];
  COMPANY_TITLE?: string;
  COMMENTS?: string;
  SOURCE_ID?: string;
  OPENED?: 'Y' | 'N';
}

/**
 * Pushes a lead to Bitrix24 as a Contact
 */
export async function pushContact(domain: string, token: string, lead: any) {
  if (!domain || !token) {
    throw new Error('Bitrix24 configuration missing');
  }

  // Construct base URL
  // If token is a webhook, URL usually looks like: https://DOMAIN/rest/USER_ID/TOKEN/
  // Since we don't have USER_ID in the UI yet, we assume token is either the full path or the domain is correct.
  // Standard Webhook format: https://[your_domain]/rest/[user_id]/[webhook_code]/[method]
  
  // For simplicity, we'll try to detect if token is just the code or contains more
  const baseUrl = token.startsWith('http') 
    ? token 
    : `https://${domain.replace(/\/$/, '')}/rest/1/${token}/`;

  const method = 'crm.contact.add.json';
  const url = baseUrl.endsWith('/') ? `${baseUrl}${method}` : `${baseUrl}/${method}`;

  // Map lead to Bitrix contact fields
  const [firstName, ...lastNames] = lead.name.split(' ');
  const lastName = lastNames.join(' ') || 'Lead';

  const params: BitrixContactParams = {
    NAME: firstName,
    LAST_NAME: lastName,
    COMPANY_TITLE: lead.company,
    COMMENTS: `Lead from Brilliance UAE.\nTier: T${lead.tier}\nScore: ${lead.score}\nSource: ${lead.source}\nLocation: ${lead.location}\nBudget: ${lead.budgetMin || 0} - ${lead.budgetMax || 0} AED\nNotes: ${lead.notes || 'No notes'}`,
    SOURCE_ID: 'ADVERTISING',
    OPENED: 'Y',
  };

  if (lead.phone) {
    params.PHONE = [{ VALUE: lead.phone, VALUE_TYPE: 'MOBILE' }];
  }

  if (lead.email) {
    params.EMAIL = [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: params }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || `Bitrix24 error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.result; // Returns the ID of the created contact
}

/**
 * Updates an existing contact in Bitrix24
 */
export async function updateContact(domain: string, token: string, contactId: string, lead: any) {
  if (!domain || !token || !contactId) return null;

  const baseUrl = token.startsWith('http') 
    ? token 
    : `https://${domain.replace(/\/$/, '')}/rest/1/${token}/`;

  const method = 'crm.contact.update.json';
  const url = baseUrl.endsWith('/') ? `${baseUrl}${method}` : `${baseUrl}/${method}`;

  const params: Partial<BitrixContactParams> = {
    COMMENTS: `Lead from Brilliance UAE.\nTier: T${lead.tier}\nScore: ${lead.score}\nSource: ${lead.source}\nLocation: ${lead.location}\nBudget: ${lead.budgetMin || 0} - ${lead.budgetMax || 0} AED\nNotes: ${lead.notes || 'No notes'}`,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contactId, fields: params }),
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) {
      const result = await response.json();
      return result.result;
    }
  } catch (err) {
    console.error("Bitrix24 update error:", err);
  }
  return null;
}

/**
 * Pushes a lead to Bitrix24 as a Deal linked to a Contact
 */
export async function pushDeal(domain: string, token: string, contactId: string, lead: any) {
  if (!domain || !token || !contactId) {
    throw new Error('Bitrix24 configuration or contact ID missing');
  }

  const baseUrl = token.startsWith('http') 
    ? token 
    : `https://${domain.replace(/\/$/, '')}/rest/1/${token}/`;

  const method = 'crm.deal.add.json';
  const url = baseUrl.endsWith('/') ? `${baseUrl}${method}` : `${baseUrl}/${method}`;

  // Parse property preferences robustly
  const propertyPref = lead.propertyPref;
  let propType = 'Property';
  let propBeds = '';
  if (propertyPref) {
    let prefObj: any = null;
    if (typeof propertyPref === 'object') {
      prefObj = propertyPref;
    } else if (typeof propertyPref === 'string') {
      try {
        prefObj = JSON.parse(propertyPref);
      } catch (e) {}
    }

    if (prefObj) {
      if (Array.isArray(prefObj.types) && prefObj.types.length > 0) {
        propType = prefObj.types.join(', ');
      } else if (prefObj.type) {
        propType = String(prefObj.type);
      }
      
      if (prefObj.bedrooms) {
        propBeds = `${prefObj.bedrooms} beds`;
      } else if (prefObj.beds) {
        propBeds = `${prefObj.beds} beds`;
      }
    }
  }

  const bedsString = propBeds ? ` (${propBeds})` : '';

  // Construct deal parameters
  const params = {
    TITLE: `Deal: ${lead.name} - ${propType}`,
    CONTACT_ID: contactId,
    OPPORTUNITY: lead.budgetMax || lead.budgetMin || 0,
    CURRENCY_ID: 'AED',
    COMMENTS: `Lead from Brilliance UAE.\nTier: T${lead.tier}\nScore: ${lead.score}\nLocation: ${lead.location}\nProperty: ${propType}${bedsString}\nSource: ${lead.source}`,
    OPENED: 'Y',
    SOURCE_ID: 'ADVERTISING',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: params }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || `Bitrix24 error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.result; // Returns the ID of the created deal
}

/**
 * Tests the connection to Bitrix24
 */
export async function testConnection(domain: string, token: string) {
  try {
    const baseUrl = token.startsWith('http') 
      ? token 
      : `https://${domain.replace(/\/$/, '')}/rest/1/${token}/`;

    const method = 'app.info.json';
    const url = baseUrl.endsWith('/') ? `${baseUrl}${method}` : `${baseUrl}/${method}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return false;
    
    const data = await response.json();
    return !!data.result;
  } catch (e) {
    return false;
  }
}

// OAuth methods (keep for future use/refactoring)

/**
 * Schedules a follow-up calendar event linked to the Contact in Bitrix24
 */
export async function scheduleFollowUp(
  domain: string, 
  token: string, 
  contactId: string, 
  eventDetails: { title: string; description: string; startTime: string; endTime: string }
) {
  if (!domain || !token || !contactId) {
    throw new Error('Bitrix24 configuration or contact ID missing');
  }

  const baseUrl = token.startsWith('http') 
    ? token 
    : `https://${domain.replace(/\/$/, '')}/rest/1/${token}/`;

  // We use crm.activity.add to create a meeting (TYPE_ID: 1)
  const method = 'crm.activity.add.json';
  const url = baseUrl.endsWith('/') ? `${baseUrl}${method}` : `${baseUrl}/${method}`;

  // First, we optionally need the assigned employee to make them responsible. 
  // For now, if we don't know the RESPONSIBLE_ID, Bitrix usually defaults to the token owner, 
  // or we can fetch the contact to get its ASSIGNED_BY_ID.
  // To keep it simple and efficient, we will let Bitrix assign it to the token owner.

  const params = {
    SUBJECT: eventDetails.title || 'Follow-up Meeting',
    DESCRIPTION: eventDetails.description || 'Scheduled follow-up from Brilliance UAE',
    DESCRIPTION_TYPE: 1, // 1 is plain text
    OWNER_ID: contactId,
    OWNER_TYPE_ID: 3, // 3 is Contact
    TYPE_ID: 1, // 1 is Meeting
    START_TIME: eventDetails.startTime,
    END_TIME: eventDetails.endTime,
    // Note: If you want to link communications (like phone), you can add the COMMUNICATIONS array here.
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: params }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error_description || `Bitrix24 error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.result; // Returns the ID of the created activity/event
}


export async function getAuthUrl() {
  const clientId = process.env.BITRIX24_CLIENT_ID;
  const redirectUri = process.env.BITRIX24_REDIRECT_URI;
  
  if (!clientId || !redirectUri) {
    throw new Error('Bitrix24 credentials missing');
  }

  return `https://oauth.bitrix.info/oauth/authorize/?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function exchangeCode(code: string) {
  const clientId = process.env.BITRIX24_CLIENT_ID;
  const clientSecret = process.env.BITRIX24_CLIENT_SECRET;
  const redirectUri = process.env.BITRIX24_REDIRECT_URI;
  
  if (!clientId || !clientSecret) {
    throw new Error('Bitrix24 OAuth credentials missing (BITRIX24_CLIENT_ID / BITRIX24_CLIENT_SECRET)');
  }

  const url = `https://oauth.bitrix.info/oauth/token/?grant_type=authorization_code&client_id=${clientId}&client_secret=${clientSecret}&code=${code}&redirect_uri=${encodeURIComponent(redirectUri || '')}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Bitrix24 OAuth token exchange failed: ${errorText}`);
  }

  return res.json();
}
