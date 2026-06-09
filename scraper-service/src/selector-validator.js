import * as cheerio from 'cheerio';

const PLAYWRIGHT_ENGINES = [
  'xpath=', 'text=', 'id=', 'role=', 'nth=', 'visible=',
  'internal:role=', 'internal:text=', 'internal:has-text=', 'internal:has=',
  'internal:label=', 'internal:testid=', 'internal:placeholder=',
  'internal:alt-text=', 'internal:title='
];

/**
 * Check if braces, brackets, parentheses, and quotes are balanced in a selector string.
 * Accounts for escaping and ignores contents inside matching quotes.
 */
function hasBalancedBrackets(str) {
  const stack = [];
  const opening = ['[', '(', '{'];
  const closing = [']', ')', '}'];
  const pairs = { ']': '[', ')': '(', '}': '{' };
  
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    // Handle backslash escape
    if (char === '\\') {
      i++;
      continue;
    }

    // Handle quotes
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      continue;
    }

    // Ignore brackets inside quotes
    if (inSingleQuote || inDoubleQuote || inBacktick) {
      continue;
    }

    if (opening.includes(char)) {
      stack.push(char);
    } else if (closing.includes(char)) {
      if (stack.length === 0 || stack[stack.length - 1] !== pairs[char]) {
        return false;
      }
      stack.pop();
    }
  }

  return stack.length === 0 && !inSingleQuote && !inDoubleQuote && !inBacktick;
}

/**
 * Validates whether a selector matches Playwright engine syntax or standard CSS.
 */
export function isValidPlaywrightSelector(selector) {
  if (!selector || typeof selector !== 'string') return false;
  const trimmed = selector.trim();
  if (!trimmed) return false;

  // 1. Check brackets and quotes balance first
  if (!hasBalancedBrackets(trimmed)) {
    return false;
  }

  // 2. Handle chained selectors separated by '>>'
  if (trimmed.includes('>>')) {
    const parts = trimmed.split('>>');
    return parts.every(part => isValidPlaywrightSelector(part.trim()));
  }

  const lower = trimmed.toLowerCase();

  // 3. XPath Check
  if (trimmed.startsWith('//') || trimmed.startsWith('xpath=') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }

  // 4. Playwright Engines check (role, id, text, internal:*, etc.)
  const isPlaywrightEngine = PLAYWRIGHT_ENGINES.some(prefix => lower.startsWith(prefix));
  if (isPlaywrightEngine) {
    return true;
  }

  // 5. Clean CSS for Cheerio check
  let cleanSelector = trimmed;
  if (cleanSelector.startsWith('css=')) {
    cleanSelector = cleanSelector.substring(4);
  }

  // Strip Playwright specific CSS pseudo-classes that break standard CSS parsers
  cleanSelector = cleanSelector
    .replace(/:has-text\s*\([^)]*\)/g, '')
    .replace(/:text\s*\([^)]*\)/g, '')
    .replace(/:visible/g, '')
    .replace(/:text-is\s*\([^)]*\)/g, '')
    .replace(/:nth-match\s*\([^)]*\)/g, '')
    .replace(/:has\s*\([^)]*\)/g, '');

  if (!cleanSelector.trim()) {
    return true;
  }

  try {
    const $ = cheerio.load('<div></div>');
    $(cleanSelector);
    return true;
  } catch (e) {
    // If it contains characters that look like Playwright extensions or custom selectors, fallback to true if brackets balanced
    const hasSpecialChars = /[:=]/.test(cleanSelector);
    if (hasSpecialChars) {
      console.log(`[SelectorCheck] Cheerio failed to parse complex selector "${cleanSelector}", fallback to true.`);
      return true;
    }
    return false;
  }
}

/**
 * Validate object containing selectors
 */
export function validateSelectors(obj) {
  if (!obj) return { valid: true };
  const errors = [];
  const checkValue = (val, path) => {
    if (typeof val === 'string') {
      if (!isValidPlaywrightSelector(val)) {
        errors.push(`Invalid selector at ${path}: "${val}"`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, index) => {
        checkValue(item, `${path}[${index}]`);
      });
    } else if (typeof val === 'object' && val !== null) {
      for (const key of Object.keys(val)) {
        checkValue(val[key], `${path}.${key}`);
      }
    }
  };
  checkValue(obj, 'selectors');
  return {
    valid: errors.length === 0,
    errors
  };
}

export async function checkContentSelectors(page, source, brokenSelectorsAccumulator = []) {
  const contentSelectors = source.contentSelectors || {};

  const fieldsToCheck = [
    { key: 'namePatterns', label: 'Name' },
    { key: 'companyPatterns', label: 'Company' },
    { key: 'rolePatterns', label: 'Role' }
  ];

  for (const field of fieldsToCheck) {
    const patterns = contentSelectors[field.key] || [];
    if (patterns.length === 0) continue;

    let matchFound = false;
    for (const pattern of patterns) {
      let selector = pattern;
      if (pattern.startsWith('class*=')) {
        selector = `[class*="${pattern.split('=')[1]}"]`;
      } else if (pattern.startsWith('data-')) {
        selector = `[${pattern}]`;
      } else if (pattern.startsWith('href*=')) {
        selector = `[href*="${pattern.split('=')[1]}"]`;
      }

      if (!isValidPlaywrightSelector(selector)) {
        continue;
      }

      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          matchFound = true;
          break;
        }
      } catch (e) {
        // Skip
      }
    }

    if (!matchFound && patterns.length > 0) {
      brokenSelectorsAccumulator.push(`Content selectors for ${field.label} [${patterns.join(', ')}] matched 0 elements on the page.`);
    }
  }
}

export async function resolveRobustLocator(page, configuredSelectors, type, brokenSelectorsAccumulator = []) {
  const selectorsToTry = Array.isArray(configuredSelectors) ? configuredSelectors.filter(Boolean) : [];

  for (const sel of selectorsToTry) {
    if (!isValidPlaywrightSelector(sel)) {
      brokenSelectorsAccumulator.push(`Invalid selector config: "${sel}"`);
      continue;
    }
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          return { locator: el, selectorUsed: sel, isFallback: false };
        }
      }
      if (count > 0) {
        console.log(`[SelectorCheck] Configured selector "${sel}" matched ${count} elements, but none were visible.`);
      }
    } catch (e) {
      brokenSelectorsAccumulator.push(`Error executing selector "${sel}": ${e.message}`);
    }
  }

  for (const sel of selectorsToTry) {
    if (sel.includes('.') || sel.includes('#') || sel.includes('_')) {
      const cleanSel = sel
        .replace(/\.[a-z0-9_-]+[-_][a-z0-9]{4,10}\b/gi, (match) => {
          const stem = match.substring(1).replace(/[-_][a-z0-9]{4,10}$/i, '');
          return `[class*="${stem}"]`;
        })
        .replace(/#[a-z0-9_-]+[-_][a-z0-9]{4,10}\b/gi, (match) => {
          const stem = match.substring(1).replace(/[-_][a-z0-9]{4,10}$/i, '');
          return `[id*="${stem}"]`;
        });

      if (cleanSel !== sel && isValidPlaywrightSelector(cleanSel)) {
        try {
          const locator = page.locator(cleanSel);
          const count = await locator.count();
          for (let i = 0; i < count; i++) {
            const el = locator.nth(i);
            if (await el.isVisible()) {
              console.log(`[SelectorCheck] Wildcard repaired selector succeeded: "${sel}" -> "${cleanSel}"`);
              return { locator: el, selectorUsed: cleanSel, isFallback: true };
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }

  console.log(`[SelectorCheck] All configured selectors for "${type}" failed/hidden. Trying robust semantic fallbacks.`);

  const fallbacks = {
    pagination: [
      'a[rel="next" i]',
      'button[aria-label*="next" i]',
      'a[aria-label*="next" i]',
      'a:has-text("Next")',
      'button:has-text("Next")',
      'a:has-text("التالي")',
      'button:has-text("التالي")',
      'a:has-text("الصفحة التالية")',
      'button:has-text("الصفحة التالية")',
      '[class*="pagination-next" i]',
      '[class*="next-page" i]',
      'a[href*="page=" i]',
      'a[href*="p=" i]'
    ],
    expandButtons: [
      'button[aria-expanded="false"]',
      'button[aria-expanded]',
      '[class*="expand" i]',
      '[class*="toggle" i]',
      '[class*="show-more" i]',
      'button:has-text("Expand")',
      'button:has-text("Show")',
      'button:has-text("More")',
      'button:has-text("توسيع")',
      'button:has-text("عرض")',
      'button:has-text("المزيد")',
      '[role="button"]:has-text("More")',
      '[role="button"]:has-text("المزيد")'
    ],
    memberLinks: [
      'a[href*="member" i]',
      'a[href*="profile" i]',
      'a[href*="rider" i]',
      'a[href*="player" i]',
      'a[href*="patron" i]',
      'a[href*="entity" i]',
      'a[href*="decree" i]',
      'a[href*="leader" i]',
      'a[href*="report" i]',
      'a[href*="view-entity" i]',
      'a[href*="company" i]',
      '[class*="member" i] a',
      '[class*="profile" i] a',
      '.company-link',
      '.directory-link',
      '.entity-link'
    ]
  };

  const fallbackList = fallbacks[type] || [];
  for (const sel of fallbackList) {
    try {
      const locator = page.locator(sel);
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const el = locator.nth(i);
        if (await el.isVisible()) {
          try {
            const tagName = await el.evaluate(node => node.tagName.toLowerCase());
            if (type === 'expandButtons' && (tagName === 'nav' || tagName === 'header' || tagName === 'footer')) {
              continue;
            }
          } catch (evaluateErr) {
            // ignore
          }
          console.log(`[SelectorCheck] Robust fallback succeeded! Used selector: "${sel}"`);
          if (selectorsToTry.length > 0) {
            brokenSelectorsAccumulator.push(`Configured selectors [${selectorsToTry.join(', ')}] were not visible/found. Resolved via fallback selector: "${sel}"`);
          }
          return { locator: el, selectorUsed: sel, isFallback: true };
        }
      }
    } catch (e) {
      // ignore
    }
  }

  if (selectorsToTry.length > 0) {
    brokenSelectorsAccumulator.push(`Configured selectors [${selectorsToTry.join(', ')}] not found/visible, and all robust fallbacks failed.`);
  }
  return null;
}


