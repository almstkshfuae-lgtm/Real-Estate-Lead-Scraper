/**
 * PAGINATION_END_SIGNALS — internal text patterns the scraper watches for
 * to detect the end of a paginated list. These are NEVER shown to the user.
 */
export const PAGINATION_END_SIGNALS = [
  "You've reached the end of the list",
  "لقد وصلت إلى نهاية القائمة",
  "reached the end"
];

/**
 * CONSENT_ACCEPT_SELECTORS — internal CSS/Playwright selectors used to
 * automatically dismiss cookie / consent banners. These are NEVER shown
 * to the user; only USER_FACING_MESSAGES keys are surfaced in UI.
 */
export const CONSENT_ACCEPT_SELECTORS = [
  'button[aria-label*="Accept all" i]',
  'button[aria-label*="Agree" i]',
  'button:has-text("Accept all")',
  'button:has-text("Agree")',
  'button:has-text("I agree")',
  'button:has-text("قبول الكل")',
  'button:has-text("أوافق")',
  'form button'
];

/**
 * CONSENT_MODAL_SELECTORS — same principle as above; internal only.
 */
export const CONSENT_MODAL_SELECTORS = [
  'button:has-text("Accept all")',
  'button:has-text("Agree")',
  'button:has-text("I agree")',
  'button:has-text("قبول الكل")',
  'button:has-text("أوافق")'
];

/**
 * USER_FACING_MESSAGES — the ONLY strings that may appear in UI
 * notifications, toasts, or webhook payloads visible to agents.
 *
 * Keyed by scenario so callers can do:
 *   notify(USER_FACING_MESSAGES.consentBypassFailed.en)
 *
 * Add keys here before using them; never interpolate selector strings
 * directly into a message that will be shown in the UI.
 */
export const USER_FACING_MESSAGES = {
  /** Scraper could not automatically accept a cookie/consent wall */
  consentBypassFailed: {
    en: "Could not automatically bypass the target site’s consent screen. Scrape may be incomplete.",
    ar: "لم نتمكن من تخطّي شاشة الموافقة للموقع المستهدف تلقائيًا. قد يكون البحث غير مكتمل."
  },

  /** Source site blocked the scraper with an anti-bot wall */
  botBlocked: {
    en: "The target site blocked the scraper with an anti-bot protection. Please try again later or contact the administrator.",
    ar: "قام الموقع المستهدف بحظر أداة البحث بواسطة حماية مضادة للبوت. يُرجى المحاولة لاحقًا أو التواصل مع المسؤول."
  },

  /** One or more page selectors for a source have become unreliable */
  selectorFailure: {
    en: "The scraper could not locate expected content on the target site. The source has been flagged for review.",
    ar: "لم يتمكن محرك البحث من تحديد المحتوى المتوقع على الموقع المستهدف. تم تصنيف المصدر للمراجعة."
  },

  /** Generic scrape error with no specific reason */
  scrapeError: {
    en: "An error occurred while collecting data from the target site. Please try again or contact the administrator.",
    ar: "حدث خطأ أثناء جمع البيانات من الموقع المستهدف. يُرجى المحاولة مرة أخرى أو التواصل مع المسؤول."
  }
};
