import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
  const htmlPath = path.resolve(__dirname, 'gmaps-debug.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`File does not exist: ${htmlPath}`);
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const $ = cheerio.load(html);

  console.log('=== Page Analysis ===');
  console.log(`HTML Length: ${html.length} bytes`);
  console.log(`Page Title: ${$('title').text().trim()}`);
  
  // Look for any header text
  console.log(`H1 content: ${$('h1').text().trim()}`);
  console.log(`H2 content: ${$('h2').text().trim()}`);

  // Print all visible text snippets
  const bodyText = $('body').text().trim();
  console.log('--- Body Text Preview (First 800 chars) ---');
  console.log(bodyText.substring(0, 800));

  // Let's count some key elements
  console.log('\n--- Element Counts ---');
  console.log(`Divs count: ${$('div').length}`);
  console.log(`Spans count: ${$('span').length}`);
  console.log(`Anchor tags count: ${$('a').length}`);
  console.log(`Script tags count: ${$('script').length}`);
  console.log(`Inputs count: ${$('input').length}`);
  console.log(`Buttons count: ${$('button').length}`);

  // Let's check for consent forms
  const consentButtons = $('button').filter((i, el) => {
    const txt = $(el).text().toLowerCase();
    return txt.includes('accept') || txt.includes('agree') || txt.includes('قبول') || txt.includes('أوافق');
  });
  console.log(`Consent buttons found: ${consentButtons.length}`);
  consentButtons.each((i, el) => {
    console.log(`  Button ${i+1}: text="${$(el).text().trim()}", class="${$(el).attr('class')}", id="${$(el).attr('id')}"`);
  });

  // Let's print the first 5 anchors and their hrefs
  console.log('\n--- First 5 Anchors ---');
  $('a').slice(0, 5).each((i, el) => {
    console.log(`  Anchor ${i+1}: text="${$(el).text().trim()}", href="${$(el).attr('href')}"`);
  });
}

main();
