import { chromium } from 'playwright';

/**
 * Launch Playwright Browser with MS Edge channel fallback to plain chromium.
 * Automatically respects proxy and custom settings.
 *
 * @param {object} options Playwright chromium.launch options
 * @returns {Promise<import('playwright').Browser>} Browser instance
 */
export async function launchBrowser(options = {}) {
  const launchOptions = { ...options };

  // Ensure default headless is true
  if (launchOptions.headless === undefined) {
    launchOptions.headless = true;
  }

  // Basic default arguments if not provided
  if (!launchOptions.args) {
    launchOptions.args = [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ];
  }

  // 1. Check if user configured executablePath explicitly in env
  const envPath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.BROWSER_EXECUTABLE_PATH;
  if (envPath) {
    launchOptions.executablePath = envPath;
    console.log(`🚀 Launching browser with custom executablePath: ${envPath}`);
  }

  const useEdge = process.env.SCRAPER_USE_EDGE === 'true' || (!launchOptions.executablePath && !envPath);

  // If we want Edge, let's try it first
  if (useEdge && !launchOptions.executablePath) {
    try {
      console.log('🚀 Attempting browser launch with MS Edge channel...');
      const edgeOptions = { ...launchOptions, channel: 'msedge' };
      const browser = await chromium.launch(edgeOptions);
      console.log('✅ Browser launched successfully using MS Edge channel.');
      return browser;
    } catch (err) {
      console.warn(`⚠️ Failed to launch browser with MS Edge channel: ${err.message}. Retrying with plain Chromium fallback...`);
    }
  }

  // 2. Fallback to launching standard Chromium (no channel)
  try {
    console.log('🚀 Launching browser with plain Chromium...');
    // Create copy without channel
    const fallbackOptions = { ...launchOptions };
    delete fallbackOptions.channel;
    const browser = await chromium.launch(fallbackOptions);
    console.log('✅ Browser launched successfully using plain Chromium.');
    return browser;
  } catch (err) {
    console.error(`❌ Critical launch failure (both Edge channel and plain Chromium failed): ${err.message}`);
    throw err;
  }
}
