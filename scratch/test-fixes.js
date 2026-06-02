import { maskProxyUrl } from '../scraper-service/proxy-validator.js';
import { isValidPlaywrightSelector, validateSelectors } from '../scraper-service/index.js';

// Test 1: Proxy Masking
console.log('--- Test 1: Proxy Masking ---');
const testUrls = [
  'http://myuser:mypassword@gw.dataimpulse.com:823',
  'https://agent1:secretPass123@192.168.1.100:3128',
  'socks5://user_name:p@ssw0rd@proxy.example.com:1080',
  'user:pass@host:port',
  'net::ERR_PROXY_CONNECTION_FAILED at http://user:pass@host:port',
  'Connection refused to proxy http://my_auth_user:strongPassword%23@gw.dataimpulse.com:823'
];

testUrls.forEach(url => {
  console.log(`Original: ${url}`);
  console.log(`Masked:   ${maskProxyUrl(url)}`);
  console.log('');
});

// Test 2: Selector Validation
console.log('--- Test 2: Selector Validation ---');
const testSelectors = [
  'div > span.active',
  'button:has-text("Load More")',
  'a:visible',
  '//div[@class="active"]',
  'xpath=//button[contains(text(), "More")]',
  'text=Click Me',
  'div >> css=span >> text="Details"',
  'button[attr="value"]',
  'button[attr="value"', // Invalid CSS
  'div:invalid-pseudo-class', // Invalid CSS
  '//div[@class="active"', // Invalid XPath (mismatched brackets)
];

testSelectors.forEach(selector => {
  const valid = isValidPlaywrightSelector(selector);
  console.log(`Selector: "${selector}" -> ${valid ? 'VALID ✅' : 'INVALID ❌'}`);
});

console.log('--- Test 3: Validate Nested Selectors Object ---');
const nestedObj = {
  pagination: ['a.next-page', 'button:has-text("Next")'],
  expandButtons: ['span.show', 'div:invalid['],
  details: 'span >> text="Read More"'
};

const result = validateSelectors(nestedObj);
console.log('Validation Result:', result);
