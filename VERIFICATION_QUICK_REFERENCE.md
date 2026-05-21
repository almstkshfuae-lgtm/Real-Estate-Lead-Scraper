# Source Verification Pipeline - Quick Reference

## 📋 The 4 Stages

| Stage | Focus | Pass Criteria | Blocker Issues |
|-------|-------|---------------|-----------------|
| **1. Technical Access** | Can the site be accessed? | Page loads via headless browser | Cloudflare, Auth wall, 403, SSL error |
| **2. DOM Data** | Is required data in HTML? | Name + (Company OR Role) present | Missing fields, Canvas-only, no HTML data |
| **3. Interaction Map** | How to navigate pages? | Can find pagination/load-more | No standard navigation (requires manual review) |
| **4. AI Extraction** | Can AI parse the data? | AI extracts without hallucination | AI invents fields not in text |

## 🚀 Quick Start

### Verify a Single URL

```bash
curl -X POST http://localhost:3002/verify-source \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.example.com/members",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

### Using Node Script

```bash
node scripts/verify-source-demo.js https://www.example.com/members
```

### Check Status of Existing Source

```bash
curl http://localhost:3002/verify-source/source_key
```

## ✅ APPROVED Status

**What it means**: Passed all 4 stages - ready for production

**Action**: Add to scraper immediately

```bash
curl -X POST http://localhost:3002/create-source \
  -H "Content-Type: application/json" \
  -d '{
    "key": "my_source",
    "url": "https://www.example.com/members",
    "name": "Example Members",
    "type": "Directory",
    "signals": ["Business Owner"],
    "navigationSelectors": { "pagination": ["a[rel=\"next\"]"] },
    "contentSelectors": { "namePatterns": ["[class*=\"name\"]"] },
    "secret": "scraper_secret_alpha_bravo"
  }'
```

## ❌ REJECTED Status

**What it means**: Hard blocks detected - site cannot be scraped

**Common blockers**:
- 🔐 Cloudflare Turnstile/challenge page
- 🔒 Login required (authentication wall)
- ⛔ HTTP 403 Forbidden
- 🔗 SSL certificate error
- 📍 Redirect loops
- 🎨 Canvas-only rendering (no HTML data)

**Action**: Find alternative source or negotiate API access

## ⚠️ MANUAL_REVIEW_REQUIRED Status

**What it means**: 3+ stages passed but warnings detected

**Common warnings**:
- Dynamic selectors (React/Vue hashes)
- Infinite scroll without clear trigger
- Data partially in Canvas/iframes
- AI minor hallucinations (1-2 fields)

**Action**: 
1. Manually test the URL in browser
2. Verify navigation works
3. Confirm selectors are stable across page reloads
4. Review AI extraction sample

**If manual testing succeeds**:
```bash
curl -X POST http://localhost:3002/approve-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "source_key",
    "verificationNotes": "Manually verified - selectors stable",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

**If manual testing fails**:
```bash
curl -X POST http://localhost:3002/reject-source \
  -H "Content-Type: application/json" \
  -d '{
    "sourceKey": "source_key",
    "reason": "Navigation unreliable - too many false positives",
    "secret": "scraper_secret_alpha_bravo"
  }'
```

## 📊 Response Summary Fields

```json
{
  "status": "APPROVED | REJECTED | MANUAL_REVIEW_REQUIRED | ERROR",
  "recommendation": "String explaining the decision",
  "report": {
    "overallStatus": "Current status",
    "stages": {
      "technicalAccess": { "passed": bool, ... },
      "domData": { "passed": bool, "dataQuality": 0-100, ... },
      "interactionMapping": { "passed": bool, ... },
      "aiExtraction": { "passed": bool, "confidence": 0-100, ... }
    },
    "summary": {
      "passedTests": "number of stages passed",
      "blockers": ["list of blocking issues"],
      "warnings": ["list of warnings"]
    }
  }
}
```

## 🔄 Batch Verification

Verify multiple sources at once:

```bash
curl -X POST http://localhost:3002/verify-sources-batch \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://site1.com/members",
      "https://site2.com/directory",
      "https://site3.com/profiles"
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
  "results": [ /* per-URL results */ ]
}
```

## 🔍 Database Queries

Check verification status:

```sql
-- List all sources by verification status
SELECT key, url, verificationStatus, verifiedAt 
FROM SourceConfig 
ORDER BY verificationStatus, verifiedAt DESC;

-- Find all rejected sources
SELECT key, url, verificationNotes 
FROM SourceConfig 
WHERE verificationStatus = 'rejected';

-- Find sources pending verification
SELECT key, url FROM SourceConfig 
WHERE verificationStatus = 'pending';

-- Get full verification report
SELECT key, url, verificationReport 
FROM SourceConfig 
WHERE verificationStatus = 'manual_review';
```

## ⚡ Performance

| Stage | Time | Notes |
|-------|------|-------|
| Technical Access | ~5-10s | Includes browser startup |
| DOM Data | ~5-8s | DOM parsing + analysis |
| Interaction Map | ~3-5s | CSS selector search |
| AI Extraction | ~8-15s | Depends on AI service latency |
| **Total** | **~25-40s** | Per source |
| **Batch (10 sources)** | **~6-7 min** | Sequential with 3s delays |

## 🛠️ Troubleshooting

**Verification times out**
- Check site performance manually
- Try different proxy
- Site may be slow or blocking bots

**"Cloudflare Turnstile detected"**
- Ensure proxy is configured: `OXYLABS_PROXY_URL`
- Try different proxy provider
- Site may have removed challenge, re-verify

**"No data found" in DOM**
- Verify URL targets correct page (not homepage)
- Check if data loads dynamically (JavaScript)
- Inspect page in browser to find correct selectors

**AI extraction fails**
- Ensure Gemini API configured: `GOOGLE_AI_API_KEY`
- Check sample text was extracted (not empty)
- Review extracted data for obvious hallucinations

**Dynamic selectors flagged**
- React/Vue sites use hash-based classes
- Provide parent element selectors if possible
- Flag for manual testing if too unpredictable

## 📝 Common Selector Patterns

Standardize on these patterns when creating sources:

```javascript
{
  "navigationSelectors": {
    "pagination": [
      "a[rel='next']",
      ".pagination a",
      "[aria-label*='Next']",
      "button[aria-label*='next']"
    ],
    "loadMore": [
      "button:contains('Load More')",
      "[class*='load-more']",
      "[data-action='load']"
    ],
    "memberLinks": [
      "a[href*='member']",
      "[class*='profile'] a",
      ".person-card a"
    ]
  },
  "contentSelectors": {
    "namePatterns": [
      "[data-name]",
      "[class*='member-name']",
      "[class*='person-name']",
      "h3[class*='profile']"
    ],
    "companyPatterns": [
      "[data-company]",
      "[class*='company']",
      "[class*='organization']",
      "[class*='affiliation']"
    ],
    "rolePatterns": [
      "[data-role]",
      "[class*='position']",
      "[class*='title']",
      "[class*='job-title']"
    ]
  }
}
```

## 🔐 Security Notes

- All endpoints require `SCRAPER_SECRET` (shared key)
- No credentials stored during verification
- Proxy rotates IP automatically
- User-Agent spoofed as real browser
- Respects robots.txt delays (3s between requests in batch)

## 📖 Full Documentation

See [VERIFICATION_PIPELINE_GUIDE.md](./VERIFICATION_PIPELINE_GUIDE.md) for detailed docs.

## 🎯 Workflow Checklist

```
[ ] 1. Identify target URL (e.g., members directory)
[ ] 2. Run verification: POST /verify-source
[ ] 3. Check result status:
    - [ ] APPROVED → proceed to step 4
    - [ ] REJECTED → find alternative, stop
    - [ ] MANUAL_REVIEW → test manually, then step 4
[ ] 4. Create source: POST /create-source
[ ] 5. Add to scraper jobs
[ ] 6. Monitor scraping results
[ ] 7. Re-verify monthly (or after site changes)
```
