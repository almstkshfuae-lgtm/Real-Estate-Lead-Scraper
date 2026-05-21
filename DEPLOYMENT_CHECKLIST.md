# Configuration & Deployment Checklist

## Pre-Deployment Configuration

### ✅ Local Environment Variables

**scraper-service/.env**
```
□ PORT=3002
□ SCRAPER_SECRET=scraper_secret_alpha_bravo
□ NODE_ENV=development
```

**Root project .env.local**
```
□ SCRAPER_SERVICE_URL=http://localhost:3002
□ SCRAPER_SECRET=scraper_secret_alpha_bravo
□ GOOGLE_AI_API_KEY=AIzaSyBQlspLRxlKa4_ikw6LdcFU9nmh86yZw2Y
□ DATABASE_URL=mysql://user:pass@host:3306/dbname
□ NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### ✅ Verification Checklist

- [ ] Node.js version 18+ installed: `node --version`
- [ ] npm packages installed: `npm install && cd scraper-service && npm install`
- [ ] Database migrations current: `npx prisma migrate dev`
- [ ] Google AI key is valid and has quota
- [ ] Git repository is clean: `git status`
- [ ] No PORT conflicts: `lsof -i :3000` and `lsof -i :3002` should be empty

---

## Local Testing Checklist

### ✅ Phase 1: Service Startup

**Terminal 1 - Scraper Service**
```bash
cd scraper-service
npm start
```

- [ ] Process starts without errors
- [ ] Shows: `🎯 Playwright Scraper Service listening on port 3002`
- [ ] Shows: `📍 Available sources: [list of 7 sources]`

**Terminal 2 - Frontend**
```bash
npm run dev
```

- [ ] Process starts without errors
- [ ] Shows: `Local: http://localhost:3000`
- [ ] No EADDRINUSE errors

### ✅ Phase 2: Service Health

**Terminal 3 - Test Endpoints**

Health Check:
```bash
curl http://localhost:3002/health
# Expected: {"status":"healthy","service":"playwright-scraper"}
```
- [ ] Returns 200 status
- [ ] Response contains status="healthy"

Sources Discovery:
```bash
curl http://localhost:3002/sources
# Expected: Array of 7 HNWI sources
```
- [ ] Returns 200 status
- [ ] Array contains: alforsan, adec, rotary, whatson, etc.
- [ ] Each source has: key, name, url, type, signals

Database Connection:
```bash
npx prisma studio
```
- [ ] Opens at http://localhost:5555
- [ ] Can view Lead, ScrapeRun, User tables
- [ ] No connection errors in console

### ✅ Phase 3: Single Source Test

Scrape Single Source:
```bash
curl -X POST http://localhost:3002/scrape-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "whatson",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

- [ ] Returns 200 status within 30 seconds
- [ ] Response includes: url, name, type, content, contentLength
- [ ] Content is not empty (demonstrates successful scraping)
- [ ] Signals array populated from source config

### ✅ Phase 4: AI Extraction Test

Test AI Functions (Node.js REPL):
```javascript
// In project root
node
> import { enrichLeadWithAI } from './lib/ai.ts'
> const testLead = {
    name: "Sheikh Mohammed",
    company: "Al Maktoum Holdings",
    role: "Chairman",
    source: "Al Forsan"
  }
> await enrichLeadWithAI(testLead)
// Should return enriched lead with score, tier, signals
```

- [ ] AI response received (not null)
- [ ] Contains: score (0-100), tier (1-3), signals (array)
- [ ] No API errors in console

### ✅ Phase 5: Frontend Testing

Browser Testing:
```
1. Go to http://localhost:3000
2. Log in as admin/agent user
3. Navigate to /leads page
4. Verify table loads without errors
```

- [ ] Page loads successfully
- [ ] No console errors (F12 DevTools)
- [ ] Table renders (even if empty)
- [ ] Can view filters

### ✅ Phase 6: Full Pipeline Test

Trigger Scrape:
```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -b "your_session_cookie" \
  -d '{
    "sources": ["whatson"],
    "criteria": {}
  }'
```

- [ ] Returns 200 status
- [ ] Response includes: runId, message, sources
- [ ] Check database for new ScrapeRun record
- [ ] Status shows "PROCESSING"

Monitor Pipeline:
```bash
# Every 5 seconds, check ScrapeRun status
npx prisma studio
# Look for your runId in ScrapeRun table
```

- [ ] Status eventually changes from PROCESSING → COMPLETED
- [ ] leadsFound increases (if leads extracted)
- [ ] logUrl is populated
- [ ] Check logs for any errors

### ✅ Phase 7: Database Verification

```bash
npx prisma studio
# Navigate to Lead table
```

- [ ] New leads appear in table
- [ ] Leads have: name, company, role, score, tier, signals, persona
- [ ] Scores range 0-100
- [ ] Tiers are 1, 2, or 3
- [ ] Persona text is populated
- [ ] scrapeRunId matches your test run
- [ ] createdAt is recent

### ✅ Phase 8: Frontend Display

```
1. Refresh http://localhost:3000/leads
2. Check if new leads appear
3. Click on a lead to view details
```

- [ ] New leads appear in table
- [ ] Can filter by score/tier
- [ ] Clicking lead shows full details
- [ ] Persona analysis displays
- [ ] No console errors

---

## Production Deployment Checklist

### ✅ Pre-Deployment

- [ ] All local tests passing
- [ ] Git repository has no uncommitted changes
- [ ] Production environment variables prepared
- [ ] Railway account created
- [ ] Vercel deployment connected to GitHub
- [ ] Database backup created
- [ ] Production secrets securely stored

### ✅ Railway Deployment (Scraper Service)

**Setup:**
- [ ] Create new Railway project
- [ ] Connect GitHub repo
- [ ] Select scraper-service as root directory
- [ ] Configure environment variables:
  - [ ] SCRAPER_SECRET (production value, not default)
  - [ ] NODE_ENV=production
  - [ ] PORT=3002

**Build & Deploy:**
- [ ] Railway builds successfully (check logs)
- [ ] Deployment completes without errors
- [ ] Public URL generated (e.g., scraper-prod-xxxx.railway.app)
- [ ] Health check accessible: `/health` returns 200

**Verification:**
```bash
curl https://scraper-prod-xxxx.railway.app/health
curl https://scraper-prod-xxxx.railway.app/sources
```

- [ ] Both endpoints return expected responses
- [ ] No CORS errors
- [ ] No timeout issues

### ✅ Vercel Deployment (Frontend)

**Environment Variables:**
- [ ] SCRAPER_SERVICE_URL set to Railway URL
- [ ] SCRAPER_SECRET matches production value
- [ ] GOOGLE_AI_API_KEY set to production key
- [ ] DATABASE_URL set to production database
- [ ] All other secrets configured

**Build & Deploy:**
- [ ] Vercel builds successfully (check logs)
- [ ] No build errors or warnings
- [ ] Deployment completes
- [ ] Preview URL generates

**Verification:**
```
1. Visit production URL
2. Test login functionality
3. Navigate to /leads page
4. Verify no console errors (DevTools)
```

- [ ] Site loads without errors
- [ ] Login works
- [ ] Can trigger scrape from dashboard
- [ ] Can view leads

### ✅ Production Testing

**Test Full Pipeline:**
```bash
curl -X POST https://your-domain.com/api/scrape \
  -H "Content-Type: application/json" \
  -b "production_session_cookie" \
  -d '{
    "sources": ["whatson"],
    "criteria": {}
  }'
```

- [ ] Returns 200 status
- [ ] runId generated successfully
- [ ] Check production database for ScrapeRun record
- [ ] Pipeline completes without errors

**Monitor Logs:**
- [ ] Check Vercel Function logs
- [ ] Check Railway service logs
- [ ] Review Google AI usage
- [ ] Check Vercel Blob logs storage

### ✅ Post-Deployment

- [ ] DNS pointing correctly
- [ ] SSL certificate valid
- [ ] All services showing healthy status
- [ ] Monitoring/alerting configured
- [ ] Backup schedule verified
- [ ] Document production URLs
- [ ] Team informed of new system
- [ ] Runbook created for maintenance

---

## Monitoring Checklist (Ongoing)

### ✅ Daily Checks

- [ ] Services healthy: `/health` endpoints return 200
- [ ] No error logs in past 24 hours
- [ ] Lead count increasing normally
- [ ] Google AI usage within budget
- [ ] Database disk usage acceptable

### ✅ Weekly Checks

- [ ] API response times normal (< 2s)
- [ ] No failed scraping runs
- [ ] AI extraction accuracy acceptable
- [ ] Lead quality scores reasonable
- [ ] Zero downtime incidents

### ✅ Monthly Checks

- [ ] Cost tracking: <$50/month
- [ ] API quota renewal upcoming
- [ ] Database backup integrity tested
- [ ] Performance optimization opportunities
- [ ] HNWI source status check (still accessible?)

---

## Rollback Plan

If critical issues arise in production:

**Step 1: Immediate**
- [ ] Disable scrape endpoints in Vercel
- [ ] Stop scraper service on Railway
- [ ] Notify team of issue

**Step 2: Investigation**
- [ ] Check recent logs
- [ ] Review recent code changes
- [ ] Identify root cause
- [ ] Test locally

**Step 3: Resolution**
- [ ] Either: Fix and redeploy, or
- [ ] Revert to previous working deployment

**Step 4: Recovery**
- [ ] Re-enable services
- [ ] Monitor closely
- [ ] Update incident log

---

## Troubleshooting Matrix

| Symptom | Check | Action |
|---------|-------|--------|
| Scraper won't start | Port 3002 in use | `kill -9` process or change PORT |
| No leads found | Google AI key valid | Verify API key, check quota |
| Frontend errors | Console DevTools | Check env variables, rebuild |
| Slow responses | Database query | Check database indexes, restart service |
| Timeout errors | Service logs | Increase timeout, scale Railway instance |
| No database connection | DATABASE_URL | Verify URL format, test connection |

---

## Sign-Off

- [ ] All tests passing (local)
- [ ] All tests passing (production)
- [ ] Documentation complete
- [ ] Team trained
- [ ] Monitoring configured
- [ ] Go-live approved

**Deployed By**: _______________  
**Date**: _______________  
**Notes**: _______________

