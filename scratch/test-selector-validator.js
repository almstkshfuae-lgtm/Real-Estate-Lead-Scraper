import { isValidPlaywrightSelector } from '../scraper-service/src/selector-validator.js';

const testCases = [
  // Standard CSS selectors
  { sel: 'div.name', expected: true },
  { sel: '#id-selector', expected: true },
  { sel: 'button[disabled]', expected: true },
  { sel: 'a[href*="next"]', expected: true },

  // Standard Playwright engines
  { sel: 'xpath=//button[@id="next"]', expected: true },
  { sel: '//button[@id="next"]', expected: true },
  { sel: 'text=Next', expected: true },
  { sel: 'role=button[name="Next"]', expected: true },
  { sel: 'id=next-button', expected: true },
  { sel: 'internal:role=button[name="Next"i]', expected: true },

  // Playwright chains
  { sel: 'div.container >> role=button[name="Next"]', expected: true },
  { sel: 'a[rel="next" i] >> xpath=//span', expected: true },

  // Complex selectors with pseudo-classes
  { sel: 'button:has-text("Load More")', expected: true },
  { sel: 'div:has(p)', expected: true },
  { sel: 'button:visible', expected: true },

  // Malformed / Invalid selectors
  { sel: 'div[class="open', expected: false }, // Unbalanced brackets
  { sel: 'button(name="test"', expected: false }, // Unbalanced parenthesis
  { sel: "a[href='test]", expected: false }, // Unbalanced quotes
];

console.log('🧪 Starting Selector Validator tests...');
let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = isValidPlaywrightSelector(tc.sel);
  if (result === tc.expected) {
    console.log(`✅ Passed: "${tc.sel}" -> expected ${tc.expected}, got ${result}`);
    passed++;
  } else {
    console.error(`❌ Failed: "${tc.sel}" -> expected ${tc.expected}, got ${result}`);
    failed++;
  }
}

console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
