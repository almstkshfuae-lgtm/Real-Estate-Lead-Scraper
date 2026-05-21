# HNWI Real Estate Lead Scraper - Re-engineered Architecture

## Overview

This document outlines the re-engineered architecture that pivots the Real Estate Lead Scraper from expensive third-party subscriptions (Apify, SerpAPI, Apollo) to a **subscription-free, Abu Dhabi-focused HNWI ecosystem** strategy using internal Playwright-based web scraping.

## Architecture Layers

### 1. **Browser Scraping Layer** (scraper-service/)
- **Framework**: Express.js + Playwright
- **Purpose**: Autonomous browser automation to extract content from HNWI sources
- **Deployment**: Railway or similar cloud platform (Node.js compatible)

#### HNWI Sources Configured:
- **Equestrian & Sports Clubs**: alforsan.ae, adec.ae, dhabianequi.com, alhabtoorpoloclub.com
- **Elite Social & Business Hubs**: theartsclub.ae, rotary.ae
- **News & Lifestyle**: whatson.ae

#### Key Features:
- Mimics human browser behavior (user agent spoofing, delays, headless mode bypass)
- Extracts raw DOM content (text, structure, metadata)
- Returns structured JSON with source context and signals
- Background job processing for multiple sources
- Health checks and source discovery endpoints

**Endpoints:**
- `POST /scrape` - Trigger scraping of multiple sources (background job)
- `POST /scrape-source` - Synchronous single-source scraping
- `GET /sources` - List available HNWI sources
- `GET /health` - Service health check

---

### 2. **AI Processing Layer** (lib/ai.ts)
- **Framework**: Google Gemini
- **Purpose**: Transform unstructured scraped content into qualified leads

#### AI Functions:

**extractHNWILeads()** - HNWI-specific extraction
- Input: Scraped DOM content with source metadata
- Extracts: Name, company, role, email, phone, signals
- Returns: Structured lead objects matching Prisma schema
- Context-aware: Uses source type and signals to identify qualified prospects

**enrichLeadWithAI()** - Lead scoring and classification
- Assigns investment score (0-100)
- Assigns tier (1=UHNW, 2=HNW, 3=Standard)
- Generates investment signals
- Abu Dhabi real estate focused

**generatePersonaAnalysis()** - Behavioral profiling
- Creates buyer persona for each lead
- Identifies investment motivation and risk profile
- Predicts property alignment

---

### 3. **Main Orchestration Pipeline** (app/api/scrape/route.ts)
- **Framework**: Next.js API Route
- **Purpose**: Coordinate scraping, AI processing, and database storage

#### Pipeline Flow:
1. **Receive Request** - Auth check, validate sources array
2. **Create ScrapeRun** - Track pipeline execution in database
3. **Trigger Playwright Service** - Call scraper microservice
4. **Extract Leads** - AI processes scraped content
5. **Enrich Leads** - Add scores, tier, signals, personas
6. **Store in Database** - Persist to Prisma Lead model
7. **Log and Report** - Upload logs to Vercel Blob, update status

#### Request Format:
```json
{
  "sources": ["alforsan", "rotary", "whatson"],
  "criteria": { }
}
```

---

### 4. **Frontend Layer** (Next.js Dashboard)
- **Purpose**: Display processed leads with filtering and CRM integration
- **Features**: 
  - Bilingual UI (English/Arabic)
  - Filterable leads table
  - Persona analysis display
  - CRM integration (Bitrix24)
  - Export functionality

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                           │
│              (Next.js - Bilingual UI)                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│          Main Scrape Pipeline API Route                         │
│    (app/api/scrape/route.ts - Orchestration Layer)             │
└────────────────────────┬────────────────────────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
           ▼             ▼             ▼
    ┌─────────────┐ ┌────────────┐ ┌──────────────┐
    │ Playwright  │ │ AI Extract │ │ Database     │
    │ Service     │ │ & Enrich   │ │ Storage      │
    │ (Railway)   │ │ (Gemini)   │ │ (Prisma)     │
    └─────────────┘ └────────────┘ └──────────────┘
           │
           └─────┬──────────────────────────────┐
                 │                              │
        ┌────────▼────────┐          ┌──────────▼──────────┐
        │ HNWI Sources    │          │ Verify Blob Logging │
        │ • Clubs         │          │ (Vercel Storage)    │
        │ • News          │          └─────────────────────┘
        │ • Events        │
        └─────────────────┘
```

---

## Environment Configuration

### Required Environment Variables:

**Frontend (.env.local):**
```
NEXT_PUBLIC_SCRAPER_API_URL=http://localhost:3002
NEXT_PUBLIC_APP_API_URL=http://localhost:3000
GOOGLE_AI_API_KEY=AIzaSyBQlspLRxlKa4_ikw6LdcFU9nmh86yZw2Y
SCRAPER_SECRET=scraper_secret_alpha_bravo
```

**Scraper Service (.env):**
```
PORT=3002
SCRAPER_SECRET=scraper_secret_alpha_bravo
NODE_ENV=production
```

---

## Deployment Strategy

### Local Development:
```bash
# Terminal 1: Start Playwright Scraper Service
cd scraper-service
npm install
npm start

# Terminal 2: Start Next.js Frontend
cd ..
npm run dev
```

### Production Deployment:

**Scraper Service (Railway):**
1. Connect GitHub repo to Railway
2. Set root directory to `scraper-service/`
3. Set start command: `npm start`
4. Set environment variables
5. Deploy

**Frontend (Vercel):**
1. Connect GitHub repo
2. Set environment variables
3. Deploy

---

## Prisma Lead Schema

```prisma
model Lead {
  id           String    @id @default(cuid())
  name         String
  company      String
  role         String
  source       String    // "HNWI Sources"
  tier         Int       // 1, 2, or 3
  phone        String?
  email        String?
  location     String    // "Abu Dhabi"
  score        Int       // 0-100 investment potential
  signals      Json      // ["Equestrian Investor", "Business Owner"]
  persona      String?   // Full persona analysis from AI
  scrapeRunId  String
  agentId      String
  createdAt    DateTime  @default(now())
}
```

---

## Workflow Example

### Initiating a Scrape:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -b "session_token=..." \
  -d '{
    "sources": ["alforsan", "adec", "rotary", "whatson"],
    "criteria": {}
  }'
```

### Response:
```json
{
  "message": "HNWI lead scraping started",
  "runId": "cly4xk2m0000108l4h5z1x9p0",
  "sources": ["alforsan", "adec", "rotary", "whatson"]
}
```

### Pipeline Processing (Background):
1. Playwright service scrapes all 4 sources
2. AI extracts qualified leads from DOM content
3. Each lead is enriched with score, tier, signals
4. Persona analysis generated for each lead
5. Leads stored in database
6. Logs uploaded to Vercel Blob
7. ScrapeRun marked COMPLETED

### View Results:
- Dashboard automatically refreshes with new leads
- Filterable by tier, score, signals
- Persona profiles available for each lead

---

## Cost Analysis

### Before (Third-Party Subscriptions):
- **Apify**: $100-500/month (depends on usage)
- **SerpAPI**: $50-300/month
- **Apollo**: $49-500/month
- **Total**: $200-1,300/month

### After (Subscription-Free):
- **Playwright Service Hosting**: $7-25/month (Railway)
- **Gemini API**: ~$0.01-0.05 per lead extraction (pay-as-you-go)
- **Vercel Hosting**: $20-100/month (depending on usage)
- **Total**: <$50/month (even with heavy usage)

**Savings: 75-95% reduction in infrastructure costs**

---

## Future Enhancements

1. **Webhook Integration**: Scraper service POSTs results back to main app for real-time updates
2. **Caching Layer**: Redis cache for frequently accessed sources
3. **Schedule Scraping**: Cron jobs to refresh HNWI sources daily/weekly
4. **Advanced Filtering**: Save search criteria and profiles
5. **Multi-Language Support**: Arabic lead names and company data
6. **CRM Sync**: Automatic lead push to Bitrix24, HubSpot, etc.
7. **Lead Scoring Refinement**: Machine learning model based on actual conversions
8. **Competitor Intelligence**: Monitor competitor lead generation

---

## Troubleshooting

### Scraper Service Connection Issues:
```bash
# Check service health
curl http://localhost:3002/health

# Verify sources
curl http://localhost:3002/sources

# Check environment variables
echo $SCRAPER_SECRET
```

### AI Extraction Failures:
- Verify Google AI API key is valid
- Check API quota and rate limits
- Review logs for specific extraction errors

### Database Storage Issues:
- Verify DATABASE_URL is correct
- Run Prisma migrations: `npx prisma migrate dev`
- Check lead count: `npx prisma studio`

---

## Git Workflow

**Branch Strategy:**
- `main` - Production stable
- `develop` - Integration branch
- `feature/hnwi-sources` - Feature branches

**Commit Convention:**
```
feat(scraper): add alforsan.ae HNWI extraction
fix(pipeline): resolve AI enrichment timeout
docs: update deployment guide
```

---

## Support & Documentation

For questions or issues:
1. Review logs in Vercel Blob (ScrapeRun.logUrl)
2. Check browser console for frontend errors
3. Review server logs for API errors
4. Test individual sources: `/scrape-source` endpoint
5. Verify AI processing: Call `enrichLeadWithAI()` directly with test data

