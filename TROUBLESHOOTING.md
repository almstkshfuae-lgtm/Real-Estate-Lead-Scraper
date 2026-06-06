# Troubleshooting Guide - HNWI Re-engineered Architecture

## 1. Scraper Service Issues

### Problem: Scraper Service Won't Start

**Error**: `Error: listen EADDRINUSE: address already in use :::3002`

**Solution**:
```bash
# Find process using port 3002
lsof -i :3002

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3003
npm start
```

**Prevention**: Always kill scraper service before starting new instance.

---

### Problem: Port Conflict with Frontend

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find process
lsof -i :3000

# Kill it
kill -9 <PID>

# Or change port
npm run dev -- -p 3001
```

---

### Problem: Scraper Service Crashes After Starting

**Error**: Random crash after `🎯 Playwright Scraper Service listening on port 3002`

**Possible Causes**:
- Out of memory
- Playwright browser not installed
- Permissions issue

**Solutions**:

1. Reinstall Playwright:
```bash
cd scraper-service
npm install --force
npx playwright install chromium
```

2. Check memory:
```bash
# On Linux/Mac
free -h

# On Windows (PowerShell)
Get-ComputerInfo -Property TotalPhysicalMemory
```

3. Increase Node memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 npm start
```

---

### Problem: Scraper Times Out on Source

**Error**: `Error: Timeout 30000ms exceeded during navigation to <url>`

**Solution**:

1. Increase timeout in `scraper-service/index.js`:
```javascript
await page.goto(source.url, { 
  waitUntil: 'domcontentloaded',
  timeout: 60000  // Increased from 30000
});
```

2. Or wait for more page load:
```javascript
await page.waitForTimeout(5000);  // Increase from 2000
```

3. Skip problematic source temporarily:
- Comment out in HNWI_SOURCES
- Test with other sources
- Debug separately

---

### Problem: Playwright Launch Fails with "Executable doesn't exist" (Docker / Railway Version Mismatch)

**Error**: `browserType.launch: Executable doesn't exist at /ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell` (often resolves in immediate scrape job failure in 7-9 seconds).

**Cause**: A version mismatch between the installed `playwright` npm package inside the container and the pre-installed browser binaries in the Docker base image (e.g., base image has Playwright `1.49.1` binaries, but caret `^` allowed `npm install` to upgrade the npm package to `1.60.0` or newer).

**Solution**:
1. Pin the `playwright` version strictly in `scraper-service/package.json` to match the Docker base image:
   ```json
   "playwright": "1.49.1"
   ```
2. Update the `scraper-service/package-lock.json` lockfile:
   ```bash
   cd scraper-service && npm install
   ```
3. Commit both files and trigger a redeployment on Railway so the container rebuilds with matching pinned dependencies.

---

## 2. API & Pipeline Issues

### Problem: Scraper Service Not Responding to API Calls

**Error**: `Failed to trigger scraping: fetch error or timeout`

**Checklist**:

1. Is scraper service running?
```bash
curl http://localhost:3002/health
```

2. Correct URL in .env?
```bash
cat .env.local | grep SCRAPER_SERVICE_URL
```

3. Correct secret?
```bash
echo $SCRAPER_SECRET  # Should match both places
```

4. Network connectivity?
```bash
ping localhost:3002
# Or on Windows
Test-Connection localhost -Port 3002
```

---

### Problem: ScrapeRun Shows Status "PROCESSING" Forever

**Error**: Pipeline gets stuck, never completes

**Investigation**:
```bash
# 1. Check if scraper service is actually scraping
ps aux | grep node  # See running processes

# 2. Check scraper service logs
# (Tail or check last 100 lines)

# 3. Check if any errors in Google AI API
# Review lib/ai.ts error handling

# 4. Test AI extraction directly
node
> import { extractHNWILeads } from './lib/ai.ts'
> const result = await extractHNWILeads({...test_data...})
```

**Solutions**:

1. If scraper service hanging:
- Increase timeout
- Reduce content size limit
- Add error handling for stuck pages

2. If AI extraction hanging:
- Check Google AI API status
- Verify API key quota
- Check the Google Cloud console for API quota and errors

3. If database stuck:
- Check database connection
- Restart database
- Check for table locks: `SHOW OPEN TABLES WHERE In_use > 0;`

---

## 3. AI & Data Processing Issues

### Problem: No Leads Extracted (Empty Array)

**Error**: Scrape completes but leadsFound = 0

**Root Causes**:
1. Google AI key invalid
2. Model not available
3. Content format wrong
4. Prompt too strict

**Debug**:

```bash
# Test API key using Google AI or your app's internal endpoint
# Use the Google Cloud Console to validate the API key and permissions
```

```javascript
// Test AI extraction directly
import { extractHNWILeads } from './lib/ai.ts'

const testContent = `
  Sheikh Mohammed Al Maktoum is the Chairman of Al Maktoum Holdings
  and a member of the Al Forsan equestrian club.
`;

const result = await extractHNWILeads({
  url: 'https://test.ae',
  name: 'Test Source',
  type: 'News Portal',
  signals: ['Executive'],
  title: 'Test Article',
  content: testContent
});

console.log(result);  // Should have at least 1 lead
```

**Solutions**:

1. If API key invalid:
   - Regenerate in Google Cloud Console
   - Update `.env.local`
   - Test again

2. If model unavailable:
   - Check if model name is correct
   - Verify account has access
   - Check Google Cloud status page

3. If extraction too strict:
   - Edit system prompt in `lib/ai.ts`
   - Make extraction requirements less strict
   - Add more example patterns

---

### Problem: AI Extraction Returns Malformed JSON

**Error**: `JSON.parse error: Unexpected token`

**Cause**: Gemini output contains text outside JSON

**Solution**:

In `lib/ai.ts`, improve JSON extraction:
```javascript
// Current (fragile)
const jsonMatch = content.match(/\[[\s\S]*\]/);

// Better (handle edge cases)
let json = content;
const startIdx = content.indexOf('[');
const endIdx = content.lastIndexOf(']');
if (startIdx !== -1 && endIdx !== -1) {
  json = content.substring(startIdx, endIdx + 1);
}
try {
  return JSON.parse(json);
} catch (e) {
  console.error('Failed to parse:', content);
  return [];
}
```

---

### Problem: Lead Scores All the Same (No Variation)

**Error**: All leads have score = 50 or 75

**Cause**: AI enrichment not varied enough

**Solution**:

Enhance the enrichment prompt in `lib/ai.ts`:

```javascript
// Add more context factors
const systemPrompt = `
...
Consider these factors for scoring:
- Leadership position: +25 points
- Business ownership: +30 points
- Equestrian club member: +15 points
- News mention: +10 points
- Executive title: +20 points
- Company size (if mentioned): +5-10 points
...`;
```

---

## 4. Database Issues

### Problem: Cannot Connect to Database

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Solution**:

1. Check database is running:
```bash
# MySQL
mysql -u user -p -h localhost -e "SELECT 1"

# Or check process
ps aux | grep mysql
```

2. Verify DATABASE_URL format:
```
mysql://username:password@localhost:3306/databasename
```

3. Check credentials:
```bash
mysql -u <username> -p<password> -h localhost
```

---

### Problem: Connection timeouts (408) or 500 crashes on Vercel Production environment

**Error**: `500 (Internal Server Error)` or `408 (Request Timeout)` on Vercel after periods of inactivity.

**Causes**:
1. **Idle Connections**: MySQL/Railway closes inactive connections. If the Prisma proxy checks only a few specific string phrases inside the error message, serverless cold starts or other platform-specific error states (like `P1001`, `P1002`, `P1017`, `P2024`) might bypass retry logic.
2. **Empty DATABASE_URL env var**: If `DATABASE_URL` is set to an empty string on Vercel, Node.js sees the key as defined, bypassing the `||` fallback to `MYSQL_PUBLIC_URL` while Prisma's query/Rust engine still attempts to read it, leading to failures.
3. **Promise.all Concurrent Starvation**: Executing parallel queries (`leads` and `count`) with `Promise.all` triggers simultaneous connection pool handshakes, causing race conditions and fail-fast collapses if database connections are cold/reconnecting.

**Solution**:
1. **Hardened Proxy**: The `lib/prisma.ts` proxy intercepts all Prisma connection codes (starting with `P1`, plus pool timeout `P2024`) and handles common TCP network error strings. It terminates the bad socket, waits `200ms` for TCP recycling, and automatically retries the query exactly once.
2. **Dynamic URL Fallback**: The client strips empty/whitespace `DATABASE_URL` values and re-injects the resolved public database URL back into the environment (`process.env.DATABASE_URL`) to satisfy Prisma requirements.
3. **Sequential Query Execution**: In the API endpoints (e.g. `app/api/leads/route.ts`), we run the query steps sequentially instead of via `Promise.all`. This allows the first query to warm up the database connection pool, preventing connection handshake conflicts.

---

### Problem: Prisma Migration Fails

**Error**: `Error: Migration failed`

**Solution**:

1. Check current schema state:
```bash
npx prisma db pull  # Sync schema with actual DB
```

2. Reset database (careful!):
```bash
npx prisma migrate reset  # Drops and recreates
```

3. Manual fix:
```bash
npx prisma studio  # Visual DB viewer
# Manually review tables and columns
```

---

### Problem: Leads Not Saving to Database

**Error**: Pipeline completes but leads table is empty

**Debug**:

```bash
# Check if lead creation code runs
npx prisma studio
# Manually add a test lead

# Check transaction rollback
# Review app/api/scrape/route.ts error handling

# Test Prisma connection
npx ts-node -e "
import prisma from './lib/prisma';
const count = await prisma.lead.count();
console.log('Total leads:', count);
"
```

---

## 5. Frontend Issues

### Problem: Leads Page Shows No Data

**Error**: Empty table on /leads page

**Check**:

1. Are leads in database?
```bash
npx prisma studio
# Check Lead table - should have records
```

2. API returning data?
```bash
# Browser DevTools → Network tab
# Look for failed API calls
```

3. Console errors?
```bash
# F12 → Console
# Look for JS errors or failed fetches
```

**Solutions**:

1. Reload page (Ctrl+F5 hard refresh)
2. Check browser local storage for old cache
3. Verify API response in DevTools Network tab
4. Check if user has permission to see leads

---

### Problem: Scrape Button Doesn't Work

**Error**: Click button, nothing happens

**Debug**:

1. Check console (F12)
   - Look for JS errors
   - Look for failed API calls

2. Test API directly:
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -b "session_cookie" \
  -d '{"sources":["whatson"]}'
```

3. Check network (DevTools → Network)
   - Is request being sent?
   - What's the response?

**Solutions**:

1. If authentication error:
   - Log out and back in
   - Check session cookie valid

2. If API timeout:
   - Increase timeout in scraper-client.ts
   - Check scraper service is running

3. If validation error:
   - Verify sources array format
   - Check criteria object structure

---

## 6. Performance Issues

### Problem: Scraping Very Slow

**Symptoms**: Takes >60 seconds per source

**Solutions**:

1. Reduce content size:
```javascript
// In scraper-service/index.js
content: content.substring(0, 5000)  // Reduce from 10000
```

2. Increase page load timeout:
```javascript
await page.waitForTimeout(1000)  // Reduce from 2000
```

3. Disable javascript on some pages:
```javascript
await page.route('**/*.js', route => route.abort());
```

4. Scale Railway instance (add more CPU/RAM)

---

### Problem: AI Processing Slow

**Symptoms**: Takes >30 seconds per lead

**Causes**: Google AI API latency

**Solutions**:

1. Batch processing:
```javascript
// Process multiple leads in parallel
await Promise.all(leads.map(l => enrichLeadWithAI(l)));
```

2. Reduce prompt size:
```javascript
// Shorter system prompt = faster processing
```

3. Use faster model (if available):
```javascript
model: "gemini-1.0"  // Preferred Gemini model for scoring and signals
```

4. Implement caching:
```javascript
// Cache results for duplicate content
const cache = new Map();
```

---

### Problem: Database Queries Slow

**Symptoms**: `/leads` page loads slowly

**Solutions**:

1. Add indexes:
```sql
CREATE INDEX idx_lead_source ON Lead(source);
CREATE INDEX idx_lead_score ON Lead(score);
```

2. Pagination:
```javascript
// Don't load all leads at once
const leads = await prisma.lead.findMany({
  take: 20,
  skip: (page - 1) * 20
});
```

3. Select only needed columns:
```javascript
select: { id: true, name: true, score: true, ... }
```

---

## 7. Integration Issues

### Problem: Bitrix24 Integration Failing

**Error**: Cannot push leads to Bitrix24

**Debug**:

1. Check Bitrix24 credentials
2. Verify API token not expired
3. Test API endpoint directly
4. Check lead format matches Bitrix24 schema

**Solution**: Review `lib/bitrix24.ts` and test credentials

## 8. Build & Deployment Issues

### Problem: Vercel or local Next.js build fails with FATAL: JWT_SECRET environment variable is missing in production!

**Error**: `Error: FATAL: JWT_SECRET environment variable is missing in production!` during static page collection/build step.

**Cause**: Next.js evaluates route handlers and pages at build time to determine if they can be statically generated. During this module evaluation, code importing `lib/auth.ts` executed strict environment checks which threw a fatal error if `JWT_SECRET` was not provided in the build-time environment.

**Solution**: The initialization check has been deferred and bypassed during the build phase (`process.env.NEXT_PHASE === 'phase-production-build'` or `process.env.CI === 'true'`) using the `getJwtSecret()` helper. At actual runtime in production, it will still strictly enforce that the secret is present.

---

## 9. Quick Fix Checklist

For any issue, try in order:

- [ ] Restart services (scraper, frontend, database)
- [ ] Clear browser cache (Ctrl+Shift+Del)
- [ ] Check environment variables
- [ ] Check logs (DevTools, server console, Vercel)
- [ ] Test individual components (health checks, API calls)
- [ ] Review error messages for typos
- [ ] Check internet connection
- [ ] Verify credentials/API keys
- [ ] Restart computer if all else fails
- [ ] Contact support with logs/screenshots

---

## Asking for Help

When reporting issues, include:

1. **Error Message** (exact copy)
2. **Steps to Reproduce** (what you did)
3. **Environment** (local/production, OS)
4. **Logs** (console, server, Vercel)
5. **Screenshots** (error messages, DevTools)
6. **Recent Changes** (code commits)

Example:
```
Title: Scraper times out on alforsan.ae

Error: Error: Timeout 30000ms exceeded during navigation

Steps:
1. Start scraper service
2. Call GET /sources - works
3. Call POST /scrape with ["alforsan"] - hangs after 30 seconds

Environment: macOS, Node 18.17, Playwright 1.49

Logs: [paste error log]

Recent: Updated scraper-service/index.js

Happening since: Today, after last commit abc123
```

