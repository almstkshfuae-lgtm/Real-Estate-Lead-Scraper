# Data Extraction Source Verification Pipeline

## Overview

The verification pipeline implements a strict 4-stage quality assurance system for integrating new data extraction sources. Every new URL must pass comprehensive technical, content, and AI viability checks before being added to the system.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  1. Technical Access Test                                   │
│     - Headless browser (Playwright) with residential proxy  │
│     - Cloudflare detection                                  │
│     - Authentication wall detection                         │
│     - Hard blocks (403, SSL, redirects)                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. DOM Data Verification                                   │
│     - Parse rendered HTML (not static)                      │
│     - Verify required Lead schema fields                    │
│     - Name + (Company OR Role) minimum                      │
│     - Canvas/iframe content detection                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Interaction Mapping                                     │
│     - Detect CSS selectors for navigation                   │
│     - Identify: Load More, Pagination, Next buttons         │
│     - Flag unpredictable dynamic selectors                  │
│     - Generate standardized interaction profile             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. AI Extraction Viability Test                            │
│     - Extract clean DOM text (strip scripts/styles)         │
│     - Pass sample to AI model                               │
│     - Verify AI output matches source data                  │
│     - Detect hallucinations                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Integration & Configuration                                │
│     - Status: APPROVED / REJECTED / MANUAL_REVIEW           │
│     - Save to SourceConfig (ScrapeSource table)             │
│     - Store selectors and interaction profile               │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Verify Single Source

**Endpoint**: `POST /verify-source`

```bash
curl -X POST http://localhost:3002/verify-source \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com/members",
    "proxyUrl": "http://proxy:port", // optional
    "secret": "scraper_secret_alpha_bravo"
  }'
```

**Response**:
```json
{
  "status": "APPROVED|REJECTED|MANUAL_REVIEW_REQUIRED|ERROR",
  "recommendation": "APPROVED_FOR_INTEGRATION|REJECTED_HARD_BLOCKS|FLAGGED_FOR_MANUAL_REVIEW",
  "report": {
    "url": "https://www.example.com/members",
    "timestamp": "2026-05-21T10:30:00Z",
    "overallStatus": "APPROVED",
    "stages": {
      "technicalAccess": {
        "passed": true,
        "checks": {
          "accessible": true,
          "cloudflareDetected": false,
          "authWallDetected": false,
          "forbidden403": false
        }
      },
      "domData": {
        "passed": true,
        "checks": {
          "nameFieldFound": true,
          "companyFieldFound": true,
          "roleFieldFound": true,
          "minimalDataPresent": true
        },
        "sampleElements": [
          {
            "field": "name",
            "selector": "[class*='member-name']",
            "count": 25
          }
        ],
        "dataQuality": 100
      },
      "interactionMapping": {
        "passed": true,
        "navigationElements": {
          "paginationLinks": [
            { "selector": "a[rel='next']", "count": 1 }
          ]
        }
      },
      "aiExtraction": {
        "passed": true,
        "extractionTest": {
          "sampleObtained": true,
          "extractionSuccessful": true,
          "hallucinations": []
        },
        "confidence": 95
      }
    },
    "summary": {
      "totalTests": 4,
      "passedTests": 4,
      "blockers": [],
      "warnings": []
    }
  }
}
```

### 2. Verify Multiple Sources (Batch)

**Endpoint**: `POST /verify-sources-batch`

```bash
curl -X POST http://localhost:3002/verify-sources-batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.example1.com",
      "https://www.example2.com",
      "https://www.example3.com"
    ],
    "secret": "scraper_secret_alpha_bravo"
  }'
```

**Response**:
```json
{
  "total": 3,
  "approved": 2,
  "rejected": 1,
  "manualReview": 0,
  "results": [
    {
      "url": "https://www.example1.com",
      "status": "APPROVED",
      "recommendation": "APPROVED_FOR_INTEGRATION",
      "blockers": [],
      "warnings": []
    },
    {
      "url": "https://www.example2.com",
      "status": "REJECTED",
      "recommendation": "REJECTED_HARD_BLOCKS",
      "blockers": ["Cloudflare Turnstile detected"],
      "warnings": []
    }
  ]
}
```

### 3. Create Source After Verification

**Endpoint**: `POST /create-source`

```bash
curl -X POST http://localhost:3002/create-source \
  -H "Content-Type: application/json" \
  -d '{
    "key": "elite_club",
    "url": "https://www.elite-club.ae",
    "name": "Elite Club Members Directory",
    "type": "Members Directory",
    "signals": ["High Net Worth", "Business Leader"],
    "navigationSelectors": {
      "pagination": ["a[rel=\"next\"]", ".pagination a"],
      "loadMore": ["button:contains(\"Load More\")"]
    },
    "contentSelectors": {
      "namePatterns": ["[data-name]", "[class*='member-name']"],
      "companyPatterns": ["[data-company]", "[class*='organization']"],
      "rolePatterns": ["[data-role]", "[class*='position']"]
    },
    "secret": "scraper_secret_alpha_bravo"
  }'
```

### 4. Get Source Verification Status

**Endpoint**: `GET /verify-source/:sourceKey`

```bash
curl http://localhost:3002/verify-source/elite_club
```

**Response**:
```json
{
  "key": "elite_club",
  "url": "https://www.elite-club.ae",
  "verificationStatus": "verified",
  "verifiedAt": "2026-05-21T10:30:00Z",
  "technicalAccessPassed": true,
  "domDataPassed": true,
  "interactionsPassed": true,
  "aiExtractionPassed": true,
  "report": { /* full verification report */ },
  "notes": "Successfully verified and integrated"
}
```

### 5. Manual Approval

**Endpoint**: `POST /approve-source`

```bash
curl -X POST http://localhost:3002/approve-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "manual_source",
    "verificationNotes": "Manually reviewed and approved - custom selectors work well",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

### 6. Rejection

**Endpoint**: `POST /reject-source`

```bash
curl -X POST http://localhost:3002/reject-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "blocked_source",
    "reason": "Cloudflare protection too aggressive - recommend alternative source",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

### 7. List All Sources

**Endpoint**: `GET /sources`

```bash
curl http://localhost:3002/sources
```

## Verification Results & Recommendations

### ✅ APPROVED Status
- **Requirement**: All 4 stages passed
- **Action**: Add to production immediately
- **Risk Level**: LOW
- **Automation**: 100% automated scraping

Example blocker patterns that prevent approval:
- ❌ Cloudflare Turnstile challenge
- ❌ Mandatory login (authentication wall)
- ❌ HTTP 403 Forbidden
- ❌ SSL certificate errors
- ❌ Permanent redirect loops

### ⚠️ MANUAL_REVIEW_REQUIRED Status
- **Requirement**: 3+ tests passed but warnings present
- **Action**: Manual testing recommended
- **Risk Level**: MEDIUM
- **Common Issues**:
  - Dynamic selectors (React/Vue components with hashes)
  - Infinite scroll with unpredictable scroll triggers
  - Partially hidden data (some fields in Canvas/iframes)
  - AI extraction with minor hallucinations (1-2 fields)

**When to manually review**:
```
1. Open source URL in browser
2. Manually inspect navigation elements
3. Test "Load More" / pagination functionality
4. Verify CSS selector stability across page reloads
5. Check if AI extraction sample makes sense
```

### ❌ REJECTED Status
- **Requirement**: Hard block detected
- **Action**: Find alternative source
- **Risk Level**: CRITICAL
- **Blocking Issues**:
  - Cloudflare/bot protection
  - Authentication wall (login required)
  - HTTP 403/404/5xx errors
  - Redirect loops
  - No minimal data found (missing Name + Company/Role)
  - Canvas-only rendering with hidden data

## Database Integration

### Schema Storage

After verification approval, source data is stored in `SourceConfig`:

```prisma
model SourceConfig {
  id                    String
  key                   String     @unique
  url                   String
  name                  String
  type                  String
  signals               Json
  navigationSelectors   Json       // From Stage 3
  contentSelectors      Json       // From Stage 2
  
  // Verification Results
  verificationStatus    String     // pending|verified|rejected|manual_review
  verificationReport    Json       // Full report from pipeline
  verifiedAt            DateTime
  technicalAccessPassed Boolean
  domDataPassed         Boolean
  interactionsPassed    Boolean
  aiExtractionPassed    Boolean
  verificationNotes     String
  
  active                Boolean    @default(true)
  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt
}
```

## Usage Workflow

### Adding a New Source

```
1. Identify target URL (e.g., members directory)
   └─ https://www.elite-club.ae/members

2. Run verification
   └─ POST /verify-source with URL

3. Review results
   └─ APPROVED → proceed to step 4
   └─ REJECTED → find alternative source
   └─ MANUAL_REVIEW → perform manual testing

4. Create source profile
   └─ POST /create-source with extracted selectors

5. Add to scraper jobs
   └─ Include source key in scrape requests
```

### Example Workflow: Adding Elite Club

```bash
# Step 1: Verify
curl -X POST http://localhost:3002/verify-source \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.elite-club.ae/members",
    "secret": "scraper_secret_alpha_bravo"
  }'

# Step 2: If APPROVED, create source
curl -X POST http://localhost:3002/create-source \
  -H "Content-Type: application/json" \
  -d '{
    "key": "elite_members",
    "url": "https://www.elite-club.ae/members",
    "name": "Elite Club Members",
    "type": "Members Directory",
    "signals": ["Business Executive", "Investor"],
    "navigationSelectors": {
      "pagination": ["a[rel=\"next\"]"]
    },
    "contentSelectors": {
      "namePatterns": ["[class*='member-name']"],
      "companyPatterns": ["[class*='company']"]
    },
    "secret": "scraper_secret_alpha_bravo"
  }'

# Step 3: Use in scrape jobs
curl -X POST http://localhost:3002/scrape-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "elite_members",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

## Performance & Optimization

### Timing

- **Stage 1 (Technical Access)**: ~5-10 seconds
- **Stage 2 (DOM Verification)**: ~5-8 seconds
- **Stage 3 (Interaction Mapping)**: ~3-5 seconds
- **Stage 4 (AI Extraction)**: ~8-15 seconds
- **Total per source**: ~25-40 seconds

### Batch Verification

For multiple sources, batch endpoint:
- Processes in sequence (not parallel) to respect target servers
- Adds 3-second delay between verifications
- Estimated time: ~40 seconds + (n-1 × 40 seconds)

For 10 sources: ~6-7 minutes total

### Proxy Configuration

Verification automatically uses configured proxy:
- Default: Oxylabs residential proxy (if `OXYLABS_PROXY_URL` set)
- Rotates IP addresses
- Bypasses Cloudflare (most reliably)
- Optional override: pass `proxyUrl` in request body

## Verification Failure Handling

### If Technical Access Fails

- ❌ Cloudflare Turnstile detected
  - **Solution**: Use proxy from `OXYLABS_PROXY_URL` (auto-rotated)
  - **Fallback**: Flag for manual review or find alternative

- ❌ Authentication wall detected
  - **Solution**: No automated bypass possible
  - **Action**: Find public directory or alternative source

- ❌ HTTP 403 Forbidden
  - **Solution**: Try with different User-Agent or proxy
  - **Action**: Mark incompatible or find alternative

### If DOM Data Fails

- ❌ Missing Name field
  - **Check**: Verify URL targets correct page (directory, not homepage)
  - **Inspect**: Use browser DevTools to find correct selector

- ❌ No Company/Role field
  - **Check**: Some sites may have minimal data
  - **Alternative**: May still be useful if Name extraction works

- ❌ Canvas-only content
  - **Solution**: Canvas rendering is not accessible
  - **Alternative**: Check if HTML fallback exists

### If Interaction Mapping Finds Nothing

- ⚠️ No standard pagination detected
  - **Note**: Site may use custom navigation
  - **Action**: Flag for manual review of interaction pattern
  - **Proceed**: May still work if data visible on initial page

### If AI Extraction Fails

- ⚠️ Hallucinations detected
  - **Issue**: AI invented fields not in source text
  - **Action**: Review sample text and extracted data
  - **Decision**: Accept (confidence >70%) or flag for review

- ❌ No valid fields extracted
  - **Issue**: AI couldn't identify any lead data
  - **Action**: Review sample text quality
  - **Decision**: Reject or find alternative selector

## Monitoring & Maintenance

### Periodic Re-verification

Sources should be re-verified periodically:
- **Frequency**: Monthly or after site redesigns
- **Process**: Re-run verification pipeline with same URL
- **Update**: Store new selectors if changed

### Status Tracking

Monitor verification statuses:

```sql
-- Count by status
SELECT verificationStatus, COUNT(*) as count 
FROM SourceConfig 
GROUP BY verificationStatus;

-- Find failing sources
SELECT key, url, verificationNotes 
FROM SourceConfig 
WHERE verificationStatus = 'rejected';

-- Find manual review items
SELECT key, url, verificationReport 
FROM SourceConfig 
WHERE verificationStatus = 'manual_review';
```

## Security

- **Secret key required**: All verification endpoints require `SCRAPER_SECRET`
- **Proxy rotation**: Residential proxy IP rotated per request
- **User agent spoofing**: Randomized browser identification
- **Rate limiting**: Delays between requests to respect servers
- **No stored credentials**: Verification doesn't store authentication

## Troubleshooting

### Verification Times Out

- **Issue**: Playwright can't load page in 30 seconds
- **Causes**: Slow server, CDN issues, heavy JavaScript
- **Solution**: 
  - Check site performance manually
  - Try different proxy provider
  - Increase timeout in pipeline code

### Proxy Connection Fails

- **Issue**: Can't connect to proxy server
- **Check**: 
  - Is `OXYLABS_PROXY_URL` set correctly?
  - Format: `socks5://user:pass@host:port` or `http://user:pass@host:port`
  - Test proxy connectivity manually

### AI Extraction Not Working

- **Issue**: Stage 4 shows errors
- **Check**: 
  - Is Gemini API configured (`GOOGLE_AI_API_KEY`, `GOOGLE_AI_PROJECT_ID`)?
  - Are credentials valid?
  - Verify AI function is passed to verification pipeline

### Dynamic Selectors Flagged

- **Issue**: React/Vue components with hash selectors
- **Options**:
  - Provide more stable parent selectors
  - Use attribute selectors instead of class names
  - Flag for manual testing if selectors are complex

## Files & Code

- **Pipeline**: `scraper-service/verification-pipeline.js`
- **API Integration**: `scraper-service/index.js` (endpoints)
- **Database Schema**: `prisma/schema.prisma` (SourceConfig model)
- **Types**: `lib/types.ts` (TypeScript definitions)
- **Migration**: `prisma/migrations/20260521_add_verification_fields/`
