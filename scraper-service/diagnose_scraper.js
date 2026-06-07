import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env files
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const url = process.argv[2];

if (!url) {
  console.error('\n❌ Error: Please specify a URL to diagnose.');
  console.log('Usage: node scraper-service/diagnose_scraper.js <url>\n');
  process.exit(1);
}

function extractCleanTextFromHTML(html) {
  const $ = cheerio.load(html);

  // Extract and append text content from application/json, application/ld+json, and __NEXT_DATA__ scripts
  const jsonScriptContents = [];
  $('script').each((i, el) => {
    const type = $(el).attr('type');
    const id = $(el).attr('id');
    const isJson = type === 'application/json' || type === 'application/ld+json' || id === '__NEXT_DATA__';
    if (isJson) {
      const scriptText = $(el).html();
      if (scriptText && scriptText.trim()) {
        jsonScriptContents.push(scriptText.trim());
      }
    } else {
      $(el).remove();
    }
  });

  // Extract inputs and textareas placeholders and values
  $('input, textarea').each((i, el) => {
    const placeholder = $(el).attr('placeholder') || '';
    const val = $(el).val() || '';
    const textNode = [placeholder, val].filter(Boolean).join(' ');
    if (textNode.trim()) {
      $(el).replaceWith(`<span> ${textNode} </span>`);
    }
  });

  // Extract canvas labels/alternative text before removing the element
  $('canvas').each((i, el) => {
    const ariaLabel = $(el).attr('aria-label') || '';
    const title = $(el).attr('title') || '';
    const fallbackText = $(el).text() || '';
    const textNode = [ariaLabel, title, fallbackText].filter(Boolean).join(' ');
    if (textNode.trim()) {
      $(el).replaceWith(`<span> ${textNode} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Extract iframe titles before removing
  $('iframe').each((i, el) => {
    const title = $(el).attr('title') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Embedded Frame: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Extract svg title or labels before removing to preserve icons text
  $('svg').each((i, el) => {
    const title = $(el).find('title').text() || $(el).attr('aria-label') || '';
    if (title.trim()) {
      $(el).replaceWith(`<span> Icon: ${title} </span>`);
    } else {
      $(el).remove();
    }
  });

  // Remove elements that are strictly layout styling, interactive widgets or media
  $('style, noscript').remove();

  // Replace br tags with newlines
  $('br').replaceWith('\n');

  // Prepend and append spacing to block elements to prevent word merging
  $('p, div, li, h1, h2, h3, h4, h5, h6, tr, td, th, article, section, header, footer, nav, aside').each((i, el) => {
    $(el).prepend(' ').append('\n');
  });

  const bodyText = $('body').text();
  const jsonText = jsonScriptContents.join('\n');

  // Combine body text and JSON scripts, keeping newlines for structure
  const combinedText = bodyText + '\n' + jsonText;

  return combinedText
    .replace(/[ \t\r]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .replace(/\u00A0/g, ' ')
    .trim();
}

async function diagnose() {
  console.log(`\n🔍 Starting scraper diagnostics for: ${url}`);
  console.log('--------------------------------------------------');

  let browser;
  try {
    const browserOptions = {
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    };

    // Proxy setup
    const proxyUrl = process.env.DATAIMPULSE_PROXY_URL;
    if (proxyUrl) {
      console.log('🔒 Proxy configuration detected, applying for diagnostic request.');
      const username = process.env.DATAIMPULSE_PROXY_USERNAME;
      const password = process.env.DATAIMPULSE_PROXY_PASSWORD;
      const host = process.env.DATAIMPULSE_PROXY_HOST || 'gw.dataimpulse.com';
      const port = process.env.DATAIMPULSE_PROXY_PORT || '823';

      if (username && password) {
        browserOptions.proxy = {
          server: `http://${host}:${port}`,
          username,
          password
        };
      } else {
        browserOptions.proxy = { server: proxyUrl };
      }
    }

    console.log('🚀 Launching Playwright browser...');
    browser = await chromium.launch({ ...browserOptions, channel: 'msedge' });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    console.log(`📡 Navigating to URL...`);
    const startTime = Date.now();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    console.log(`✅ Loaded page with status ${response ? response.status() : 'unknown'} in ${loadTime}ms`);

    // Scrolling simulation to load dynamic content
    console.log('📜 Simulating scroll for lazy-loaded content...');
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const step = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, step);
          totalHeight += step;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(resolve, 500);
          }
        }, 100);
      });
    });
    await page.waitForTimeout(1000);

    const finalUrl = page.url();
    const html = await page.content();
    console.log(`📊 Final URL: ${finalUrl}`);
    console.log(`📊 HTML payload size: ${html.length} bytes`);

    // Run clean text extraction
    console.log('🧼 Running extractCleanTextFromHTML...');
    const cleanedText = extractCleanTextFromHTML(html);
    console.log(`📊 Cleaned text size: ${cleanedText.length} characters`);

    // Diagnostics checks
    const hasNameSignal = /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(cleanedText);
    const hasRoleSignal = /\b(CEO|Director|Founder|Chairman|Manager|President|Partner|Owner|Executive|Member|Head|Managing)\b/i.test(cleanedText);
    const hasArabicSignal = /[\u0600-\u06FF]{2,}/.test(cleanedText);
    
    console.log('\n--- VITAL SIGNS CHECK ---');
    console.log(`1. Length check (>=50 chars):  ${cleanedText.length >= 50 ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`2. Name patterns found:         ${hasNameSignal ? '✅ YES' : '❌ NO'}`);
    console.log(`3. Business roles found:        ${hasRoleSignal ? '✅ YES' : '❌ NO'}`);
    console.log(`4. Arabic characters found:     ${hasArabicSignal ? '✅ YES' : '❌ NO'}`);

    const passesThreshold = cleanedText.length >= 50 || hasNameSignal || hasRoleSignal || hasArabicSignal;
    console.log(`\nOverall extraction threshold:   ${passesThreshold ? '✅ PASSED (Will send to AI)' : '❌ SKIPPED (Insufficient Content)'}`);

    // Print text preview
    console.log('\n--- EXTRACTED TEXT PREVIEW (First 800 chars) ---');
    console.log(cleanedText.substring(0, 800) + (cleanedText.length > 800 ? '...' : ''));

    // Optional: run test extraction with Gemini if key is provided
    const geminiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey && !geminiKey.startsWith('YOUR_')) {
      console.log('\n🤖 Found Google Gemini API Key. Attempting sample lead extraction...');
      
      const systemPrompt = `You are an expert at extracting HNWI leads from UAE business websites.
Extract ONLY real people explicitly named in the text. Return an EMPTY ARRAY [] if no real names with business roles are found.
Output ONLY a JSON array containing objects with fields: name, company, role, location. No other text.`;
      
      const requestBody = {
        contents: [{ parts: [{ text: `${systemPrompt}\n\nText:\n${cleanedText.substring(0, 5000)}` }] }],
        generationConfig: { temperature: 0.0 }
      };
      
      const model = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      
      try {
        const resp = await axios.post(endpoint, requestBody, { timeout: 30000 });
        const aiText = (resp.data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
        console.log('\n--- SAMPLE AI EXTRACTION RESULTS ---');
        console.log(aiText.trim());
      } catch (aiErr) {
        console.error(`❌ AI extraction failed: ${aiErr.message}`);
      }
    } else {
      console.log('\nℹ️ Note: Set GOOGLE_AI_API_KEY env variable to test sample AI lead extraction.');
    }

  } catch (error) {
    console.error('\n❌ Diagnostics failed with error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('\n--------------------------------------------------');
  }
}

diagnose();
