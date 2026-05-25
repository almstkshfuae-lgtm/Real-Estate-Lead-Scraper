/**
 * Proxy Validation Utility for scraper-service
 * Verifies that outgoing Playwright requests successfully pass through proxy when configured
 */

import { chromium } from 'playwright';

function maskProxyUrl(url) {
  if (!url) return null;
  try {
    return url.replace(/(https?:\/\/)([^:@\s]+):([^@\s]+)@/, '$1$2:[REDACTED]@');
  } catch (e) {
    return '[REDACTED]';
  }
}

/**
 * Validates proxy connectivity by attempting a real page load through the proxy
 * Returns detailed diagnostic information for debugging connection issues
 */
export async function validateProxyConnection(proxyUrl, timeoutMs = 30000) {
  if (!proxyUrl) {
    return {
      configured: false,
      error: 'No proxy URL provided'
    };
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const startTime = Date.now();
    const context = await browser.newContext({
      proxy: { server: proxyUrl },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const page = await context.newPage();

    // Track actual response headers and details
    let requestInfo = {};
    page.on('response', (response) => {
      if (response.url().includes('example.com') || response.url().includes('httpbin')) {
        requestInfo = {
          status: response.status(),
          statusText: response.statusText(),
          url: response.url(),
          headers: Object.fromEntries(Object.entries(response.headersForURL(response.url()) || {}))
        };
      }
    });

    try {
      // Use a proxy-safe test endpoint
      await page.goto('https://httpbin.org/ip', { 
        timeout: timeoutMs, 
        waitUntil: 'domcontentloaded' 
      });

      const responseText = await page.textContent('body');
      const elapsedMs = Date.now() - startTime;

      await context.close();

      return {
        configured: true,
        status: 'connected',
        responseTime: elapsedMs,
        testUrl: 'https://httpbin.org/ip',
        responsePreview: responseText?.substring(0, 200) || 'N/A',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      await context.close();

      return {
        configured: true,
        status: 'failed',
        error: error.message || String(error),
        errorCode: error.code || 'UNKNOWN',
        elapsedMs,
        suggestions: generateProxySuggestions(error),
        timestamp: new Date().toISOString()
      };
    }
  } catch (launchError) {
    return {
      configured: true,
      status: 'launch_failed',
      error: launchError.message || String(launchError),
      suggestions: [
        'Ensure Playwright browsers are installed: npx playwright install',
        'Check that proxy credentials are URL-encoded correctly',
        'Verify proxy server is reachable and active'
      ]
    };
  } finally {
    try {
      await browser.close();
    } catch (e) {
      // ignore close errors
    }
  }
}

/**
 * Verifies egress by comparing direct public IP vs proxied public IP.
 * Returns structured details showing whether traffic is routed through the proxy.
 */
export async function verifyProxyEgress(proxyUrl, timeoutMs = 30000) {
  const result = {
    maskedProxyUrl: proxyUrl ? maskProxyUrl(proxyUrl) : null,
    directIp: null,
    proxiedIp: null,
    passed: false,
    details: {},
    timestamp: new Date().toISOString()
  };

  try {
    // Get direct public IP (no proxy) using a simple fetch
    const directResp = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', redirect: 'follow' });
    if (directResp.ok) {
      const body = await directResp.json();
      result.directIp = body.ip || null;
    } else {
      result.details.directFetchError = `HTTP ${directResp.status}`;
    }
  } catch (e) {
    result.details.directFetchError = e.message || String(e);
  }

  if (!proxyUrl) {
    result.details.note = 'No proxy URL provided; skipping proxied check.';
    return result;
  }

  // Use Playwright to perform a proxied request and observe reported IP
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  try {
    const context = await browser.newContext({ proxy: { server: proxyUrl } });
    const page = await context.newPage();

    try {
      await page.goto('https://httpbin.org/ip', { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
      const text = await page.textContent('body');
      if (text) {
        try {
          const parsed = JSON.parse(text);
          result.proxiedIp = parsed.origin || parsed.ip || null;
        } catch (e) {
          result.details.proxiedParseError = e.message || String(e);
          result.details.proxiedRaw = text.substring(0, 500);
        }
      }
    } catch (e) {
      result.details.proxiedFetchError = e.message || String(e);
    }

    await context.close();
  } catch (e) {
    result.details.browserError = e.message || String(e);
  } finally {
    try { await browser.close(); } catch (e) { }
  }

  // Determine pass/fail: proxied IP should exist and be different from direct IP
  if (result.proxiedIp) {
    // httpbin may return comma-separated origins; take first
    const proxiedFirst = String(result.proxiedIp).split(',').map(s => s.trim())[0];
    if (result.directIp && proxiedFirst && proxiedFirst !== result.directIp) {
      result.passed = true;
      result.details.reason = 'Proxied IP differs from direct IP';
    } else if (!result.directIp) {
      result.details.reason = 'Direct IP unknown - proxied IP observed';
      result.passed = !!proxiedFirst;
    } else {
      result.details.reason = 'Proxied IP matches direct IP (egress not via proxy)';
      result.passed = false;
    }
  }

  return result;
}

/**
 * Generates diagnostic suggestions based on common proxy connection errors
 */
function generateProxySuggestions(error) {
  const msg = (error.message || String(error)).toLowerCase();
  const suggestions = [];

  if (msg.includes('407') || msg.includes('auth')) {
    suggestions.push('HTTP 407 Proxy Authentication Failed — verify username/password are URL-encoded');
    suggestions.push('Check OXYLABS_PROXY_USERNAME and OXYLABS_PROXY_PASSWORD values');
  }

  if (msg.includes('connection refused') || msg.includes('econnrefused')) {
    suggestions.push('Connection refused — proxy server may be down or URL is incorrect');
    suggestions.push('Verify OXYLABS_PROXY_HOST and OXYLABS_PROXY_PORT are correct');
  }

  if (msg.includes('timeout') || msg.includes('etimedout')) {
    suggestions.push('Connection timeout — proxy server may be unreachable');
    suggestions.push('Verify your firewall allows outbound connections on proxy port');
  }

  if (msg.includes('certificate') || msg.includes('cert')) {
    suggestions.push('SSL certificate error — may need to use http:// instead of https://');
    suggestions.push('Set OXYLABS_PROXY_SCHEME=http if using residential proxies');
  }

  if (msg.includes('enotfound') || msg.includes('dns')) {
    suggestions.push('DNS resolution failed — hostname may be misspelled');
    suggestions.push('Check OXYLABS_PROXY_HOST (e.g., pr.oxylabs.io for Oxylabs)');
  }

  if (suggestions.length === 0) {
    suggestions.push('Enable DEBUG mode: set DEBUG=* when running scraper service');
    suggestions.push('Test proxy directly: curl -x <proxy-url> https://httpbin.org/ip');
  }

  return suggestions;
}

/**
 * Formats proxy validation results for console output (masked for security)
 */
export function formatProxyValidationReport(result) {
  const lines = [];
  lines.push('\n📋 Proxy Validation Report');
  lines.push('━'.repeat(50));

  if (!result.configured) {
    lines.push('❌ No proxy configured');
    return lines.join('\n');
  }

  if (result.status === 'connected') {
    lines.push(`✅ Status: Connected`);
    lines.push(`⏱️  Response time: ${result.responseTime}ms`);
    lines.push(`🔗 Test endpoint: ${result.testUrl}`);
  } else if (result.status === 'failed') {
    lines.push(`❌ Status: Connection Failed`);
    lines.push(`🔴 Error: ${result.error}`);
    if (result.errorCode) lines.push(`   Code: ${result.errorCode}`);
    if (result.elapsedMs) lines.push(`⏱️  Elapsed: ${result.elapsedMs}ms`);
  } else if (result.status === 'launch_failed') {
    lines.push(`❌ Status: Browser Launch Failed`);
    lines.push(`🔴 Error: ${result.error}`);
  }

  if (result.suggestions && result.suggestions.length > 0) {
    lines.push('\n💡 Suggestions:');
    result.suggestions.forEach((s) => lines.push(`   • ${s}`));
  }

  lines.push(`\n⏰ Tested at: ${result.timestamp || new Date().toISOString()}`);
  lines.push('━'.repeat(50));

  return lines.join('\n');
}
