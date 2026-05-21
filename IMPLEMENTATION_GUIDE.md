# HNWI Re-engineering Implementation Guide

## Phase 1: Setup & Preparation ✅

### Step 1: Verify Environment
```bash
# Check Node.js version (need 18+)
node --version

# Check Docker (optional, for local scraper service testing)
docker --version

# Verify Git status (commit all changes before proceeding)
git status
```

### Step 2: Install Scraper Service Dependencies
```bash
cd scraper-service
npm install
```

### Step 3: Create .env Files

**scraper-service/.env**
```env
PORT=3002
SCRAPER_SECRET=scraper_secret_alpha_bravo
NODE_ENV=development
```

**Root project .env.local**
```env
SCRAPER_SERVICE_URL=http://localhost:3002
SCRAPER_SECRET=scraper_secret_alpha_bravo
GOOGLE_AI_API_KEY=AIzaSyBQlspLRxlKa4_ikw6LdcFU9nmh86yZw2Y
DATABASE_URL=mysql://user:password@host/database
```

---

## Phase 2: Local Development Testing

### Step 1: Start Scraper Service
```bash
cd scraper-service
npm start

# Expected output:
# 🎯 Playwright Scraper Service listening on port 3002
# 📍 Available sources: alforsan, adec, dhabianequi, alhabtoor, artsclub, rotary, whatson
```

### Step 2: Verify Service Health
```bash
# In another terminal:
curl http://localhost:3002/health

# Expected response:
# {"status":"healthy","service":"playwright-scraper"}
```

### Step 3: List Available Sources
```bash
curl http://localhost:3002/sources

# Expected response shows all HNWI sources with metadata
```

### Step 4: Test Single Source Scraping
```bash
curl -X POST http://localhost:3002/scrape-source \
  -H "Content-Type: application/json" \
  -d '{"sourceKey":"whatson","secret":"scraper_secret_alpha_bravo"}'

# This should take 10-30 seconds and return page content
```

### Step 5: Start Frontend
```bash
# In root directory
npm run dev

# Access at http://localhost:3000
```

---

## Phase 3: Integration Testing

### Step 1: Verify API Route Integration
```bash
# Assuming you're logged in as admin/agent user
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -b "your_session_cookie" \
  -d '{
    "sources": ["whatson"],
    "criteria": {}
  }'

# Response should include runId
```

### Step 2: Monitor Pipeline Execution
```bash
# Check ScrapeRun status
npx prisma studio

# Look in ScrapeRun table for your new run
# Status should progress: PROCESSING → COMPLETED
# Check logUrl for detailed logs
```

### Step 3: Verify Leads in Database
```bash
# Query new leads
npx prisma client
const leads = await prisma.lead.findMany({
  where: { scrapeRunId: "your_run_id" }
});
console.log(leads);
```

### Step 4: Check Frontend Display
- Navigate to http://localhost:3000/leads
- Filter by recent/new status
- Verify persona analysis displays
- Check score/tier assignments

---

## Phase 4: Production Deployment

### Step 1: Deploy Scraper Service to Railway

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub
   - Create new project

2. **Connect GitHub Repository**
   - Click "Create" → "GitHub Repo"
   - Select your Real-Estate-Lead-Scraper repo

3. **Configure Deployment**
   - Set **Root Directory**: `scraper-service`
   - Set **Start Command**: `npm start`
   - Set **Port**: `3002`

4. **Add Environment Variables**
   - `SCRAPER_SECRET`: Your production secret
   - `NODE_ENV`: `production`
   - `PORT`: `3002`

5. **Deploy**
   - Railway will automatically build and deploy
   - Get the public URL (e.g., `https://scraper-prod-xxxx.railway.app`)

### Step 2: Update Frontend Environment
Update `.env.production` on Vercel:
```env
SCRAPER_SERVICE_URL=https://scraper-prod-xxxx.railway.app
SCRAPER_SECRET=your_production_secret
```

### Step 3: Deploy Frontend to Vercel
```bash
git push origin main
# Vercel automatically deploys
```

### Step 4: Verify Production Deployment
```bash
# Test scraper health
curl https://scraper-prod-xxxx.railway.app/health

# Test main API
curl -X POST https://yourdomain.com/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"sources":["whatson"]}'
```

---

## Phase 5: Optimization & Scaling

### Step 1: Configure Cron Scraping (Optional)
Create `app/api/cron/scrape-hnwi/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Trigger HNWI scraping
  const scraperUrl = process.env.SCRAPER_SERVICE_URL;
  const response = await fetch(`${scraperUrl}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sources: ['alforsan', 'adec', 'rotary', 'whatson'],
      secret: process.env.SCRAPER_SECRET
    })
  });

  return NextResponse.json({ 
    message: 'HNWI scraping scheduled',
    status: response.ok ? 'success' : 'error'
  });
}
```

### Step 2: Configure Vercel Crons
In `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/scrape-hnwi",
    "schedule": "0 */4 * * *"
  }]
}
```

### Step 3: Monitor Performance
- Track API response times
- Monitor Google AI usage and costs
- Monitor Railway hosting costs
- Review log volumes

---

## Implementation Checklist

- [ ] **Environment Setup**
  - [ ] Node.js 18+ verified
  - [ ] `.env` files created with correct values
  - [ ] Scraper service dependencies installed
  - [ ] Database migrations up to date

- [ ] **Local Testing**
  - [ ] Scraper service starts successfully
  - [ ] Health endpoint returns 200
  - [ ] Sources endpoint shows all 7 HNWI sources
  - [ ] Single source scraping returns content
  - [ ] Frontend starts without errors
  - [ ] Database connection verified

- [ ] **Integration Testing**
  - [ ] API route accepts scrape requests
  - [ ] ScrapeRun records created in database
  - [ ] Scraper service called successfully
  - [ ] Leads stored in database
  - [ ] AI enrichment applied
  - [ ] Frontend displays new leads

- [ ] **Production Deployment**
  - [ ] Railway account created
  - [ ] Scraper service deployed
  - [ ] Production environment variables set
  - [ ] Frontend deployment configured
  - [ ] Production endpoints tested
  - [ ] Logging and monitoring configured

- [ ] **Optimization**
  - [ ] Cron jobs scheduled (optional)
  - [ ] Cost tracking configured
  - [ ] Performance monitoring enabled
  - [ ] Backup strategy in place

---

## Common Issues & Solutions

### Issue: Scraper Service Connection Refused
**Solution:**
```bash
# 1. Verify service is running
curl http://localhost:3002/health

# 2. Check port is not in use
lsof -i :3002

# 3. Kill process on port if needed
kill -9 <PID>

# 4. Restart service
npm start
```

### Issue: AI Extraction Returns Empty Array
**Solution:**
- Verify Google AI key is valid
- Check Gemini model availability
- Review scraped content format
- Test with sample content directly

### Issue: Leads Not Appearing in Frontend
**Solution:**
```bash
# 1. Check database for leads
npx prisma studio

# 2. Verify ScrapeRun status
SELECT * FROM ScrapeRun WHERE id = 'run_id';

# 3. Check logs in Vercel Blob (if stored)
# 4. Review API response in browser DevTools
```

### Issue: Timeout When Scraping Large Sources
**Solution:**
- Increase timeout in scraper client
- Scrape sources individually instead of in batch
- Scale Railway instance to 2x RAM
- Implement result pagination

---

## Testing Commands Reference

```bash
# Start development environment
npm run dev                    # Frontend
npm start (scraper-service/)  # Scraper service

# Test endpoints
curl http://localhost:3002/health
curl http://localhost:3002/sources
curl http://localhost:3000/api/scrape

# Database
npx prisma studio            # GUI database viewer
npx prisma db seed          # Seed sample data
npx prisma migrate dev      # Run migrations

# Build for production
npm run build                # Frontend
cd scraper-service && npm run build

# Check logs
tail -f scraper-service/.log  # Scraper logs
# Check Vercel logs in dashboard
# Check Railway logs in dashboard
```

---

## Success Metrics

After implementation, you should see:

✅ **Cost Reduction**: 75-95% lower hosting/API costs
✅ **Zero Subscription Fees**: No recurring SaaS charges
✅ **Data Independence**: Control over scraping sources
✅ **Scalability**: Easy to add new HNWI sources
✅ **Lead Quality**: AI-enriched leads with scores and personas
✅ **Response Time**: Fast extraction and processing
✅ **Data Privacy**: All processing internal, no third-party data sharing

---

## Next Steps

1. **Follow Phase 1-2**: Complete local setup and testing
2. **Validate Results**: Ensure leads are extracted correctly
3. **Deploy Production**: Follow Phase 4 deployment steps
4. **Monitor & Optimize**: Track performance and costs
5. **Add More Sources**: Expand HNWI ecosystem as needed
6. **Integrate CRM**: Connect Bitrix24, HubSpot, etc.
7. **Scale Operations**: Add more agents, run daily scrapes

