# Brilliance - Real Estate Lead Scraper
### Find the right buyer, faster — اعثر على المشتري المناسب بشكل أسرع

A full-stack real estate lead intelligence platform for UAE agents. Scrapes, scores, qualifies, and pushes buyer leads from 11+ premium sources into Bitrix24 CRM with AI-powered pitch generation, WhatsApp Business outreach, and bilingual EN/AR support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) + TypeScript |
| Bundler | Turbopack (stable default in v16 — no flags needed) |
| Styling | Tailwind CSS + CSS variables (design system tokens) |
| Auth | Built-in login (JWT + bcrypt) — no third-party auth service |
| Network boundary | `proxy.ts` (replaces `middleware.ts` in Next.js 16) |
| Caching | `use cache` directive — explicit Cache Components model |
| Database | Railway MySQL via Prisma ORM |
| File storage | Vercel Blob (exports, scraped snapshots, lead attachments) |
| Scheduling | Vercel Cron (daily scrape jobs) |
| AI | Google Gemini API — `gemini-1.0` |
| AI debugging | Next.js DevTools MCP (built into v16) |
| Chatbot | Gemini API with conversation memory (stored in MySQL) |
| ML | TensorFlow.js — in-app learning from agent behavior and lead outcomes |
| Scraper | Node.js + Playwright (server-side, Railway hosted) |
| CRM | Bitrix24 REST API (simplified — Phase A contacts push only at launch) |
| Messaging | WhatsApp Business Cloud API |
| Deployment | Vercel (frontend + API routes) + Railway (scraper service + MySQL) |
| PWA / APK | PWABuilder — Android APK + iOS Add to Home Screen (no app store) |
| i18n | next-i18next — EN/AR, RTL/LTR via `<html dir>` |
| Map | Mapbox as the map library with the hybrid SVG + Mapbox approach|


---

## Next.js 16.2 — Key Behaviors to Know

These are breaking or architectural changes from v14/v15 that affect how this project is built.

| Change | Detail |
|--------|--------|
| Turbopack is default | No `--turbopack` flag needed. Do not add custom webpack config — builds will fail. Check all plugins for Turbopack compatibility before installing. |
| `proxy.ts` replaces `middleware.ts` | Route protection and network boundary logic lives in `proxy.ts`. Export the function as `proxy`, not `middleware`. |
| `use cache` directive | Explicit opt-in caching only. No implicit caching on fetch or routes. Use `"use cache"` at the top of any component, function, or page that should be cached. |
| Async request APIs | `cookies()`, `headers()`, `params`, `searchParams` are all async — must be `await`ed. This was introduced in v15 and carries into v16. |
| React Compiler (stable) | `reactCompiler: true` in `next.config.ts` is available but not enabled by default. Leave off until build performance is measured — it increases compile time. |
| `next lint` removed | Use Biome or ESLint directly. Do not rely on `next lint` in CI pipeline. |
| PPR flag removed | `experimental.ppr` is gone. Cache Components (`use cache`) is the replacement model. |

---

Agents configure search criteria before scraping. Leads are scored and filtered based on:

### Property Preference
- Off-plan apartment
- Villa
- Townhouse
- Penthouse
- Commercial unit

### Buyer Profile
- Budget range: AED `from` → `to`
- Recently relocated to UAE (flag from LinkedIn / press / registry date)
- Exclude rental behavior (filters out leads with rental-only inquiry history)

### Source Tier
| Tier | Sources | Score Boost |
|------|---------|-------------|
| T1 — Elite | Private Banking, Family Office, ADGM/DIFC Registry, DED Registry | +12 |
| T2 — Premium | Zawya Invest, Bloomberg MENA, Forbes ME, Elite Lifestyle & Concierge | +6 |
| T3 — Standard | Bayut, Dubizzle, Business Directories, News & Press | +0 |

### Signals
`UHNW` · `High Net Worth` · `Investor` · `Private Client` · `Business Owner` · `Executive`

### Scoring Formula
```
final_score = min(99, base_score + tier_boost + signal_bonus)

signal_bonus:
  UHNW          → +8
  High Net Worth → +4
  Investor       → +3
  Private Client → +3
  Business Owner → +2
  Executive      → +1
```

---

## Features

### Lead Management
- Filterable, sortable lead table (tier, source, signal, location, budget, property type)
- Lead detail sidebar (RTL-aware, full contact + AI pitch inline)
- UAE SVG map view — lead density per emirate, click-to-filter
- Score badge (color-coded: green ≥90, amber 75–89, red <75)
- Tier badge (T1/T2/T3) on every lead
- "Exclude rental behavior" toggle per search

### Search & Qualification
- Advanced qualification form before each scrape:
  - Property type (multi-select)
  - Budget range (AED slider + manual input)
  - Relocation flag
  - Exclude rental behavior
  - Target emirate(s)
  - Signal filter
  - Tier minimum

### AI Features
- **AI pitch generation** — Gemini API, responds in EN or AR based on active language
- **AI chatbot** — persistent, memory-aware assistant for agents (conversation stored in MySQL)
- **ML lead scoring** — TensorFlow.js model trained on historical lead outcomes and agent interactions; improves over time
- **AI signal extraction** — Gemini API parses scraped raw text to assign signals automatically

### Scraper
- Sources: Bayut, Dubizzle, Zawya Invest, Bloomberg MENA, Forbes ME, ADGM/DIFC Registry, DED Registry, Private Banking directories, Family Office networks, Elite Lifestyle/Concierge, News & Press
- Playwright (Node.js) — headless, proxy-rotated
- Incremental scrape — new leads appended, previous data never overwritten
- Optional: save selected leads only (agent manually flags before committing to DB)
- Vercel Cron: daily at 02:00 GST
- Scrape history log stored in MySQL

### Export
- CSV (UTF-8 BOM, bilingual EN/AR columns)
- XLSX (library, bold headers, auto-width)
- Both respect active filters

### CRM & Outreach (Bitrix24)
- Push qualified leads to Bitrix24 as contacts/deals via REST API
- Sync lead status bidirectionally (New → Contacted → Qualified → Won/Lost)
- Campaign manager view — group leads by property type or tier into campaigns
- WhatsApp Business Cloud API — send templated outreach messages directly from the app
- Email outreach — compose and send via Bitrix24 or direct SMTP
- Calendar sync — Bitrix24 calendar for follow-up scheduling
- Bitrix24 app integrations supported:
  - Task importer
  - Export app
  - SPA importer
  - 2-way SMS
  - Public links
  - OA Chat

### UI & Layout
- Fully responsive — mobile, tablet, desktop
- Dark mode (system-detected + manual override)
- EN/AR toggle — full RTL flip, logical CSS properties, Arabic font (Cairo/Tajawal)
- Built-in login page (email + password, JWT)
- Settings interface: profile, scraper config, integrations, notifications, theme

### PWA & Distribution
- Installable as PWA on any browser
- Android APK via PWABuilder (no Google Play Store)
- iOS: Add to Home Screen via Safari (no App Store)
- Offline: cached app shell + last lead dataset via Service Worker

---

## Database Schema (MySQL / Prisma)

```prisma
model User {
  id          String   @id @default(cuid())
  email       String   @unique
  passwordHash String
  name        String
  nameAr      String?
  role        String   @default("agent")
  theme       String   @default("system")
  language    String   @default("en")
  createdAt   DateTime @default(now())
  leads       Lead[]
  searches    Search[]
  chatHistory ChatMessage[]
}

model Lead {
  id           String    @id @default(cuid())
  name         String
  nameAr       String?
  company      String
  companyAr    String?
  role         String
  roleAr       String?
  source       String
  sourceType   String?
  tier         Int
  phone        String?
  email        String?
  location     String
  score        Int
  signals      Json
  propertyPref Json
  budgetMin    Float?
  budgetMax    Float?
  latitude     Float?
  longitude    Float?
  relocated    Boolean   @default(false)
  rentalFlag   Boolean   @default(false)
  status       String    @default("new")
  notes        String?   @db.Text
  persona      String?   @db.Text
  bitrix24Id   String?
  agentId      String
  scrapeRunId  String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  agent        User      @relation(fields: [agentId], references: [id])
  scrapeRun    ScrapeRun @relation(fields: [scrapeRunId], references: [id])

  @@unique([name, company, source, agentId])
  @@index([source])
}

model ScrapeRun {
  id          String   @id @default(cuid())
  triggeredBy String
  sources     Json
  criteria    Json
  status      String
  leadsFound  Int      @default(0)
  startedAt   DateTime @default(now())
  completedAt DateTime?
  leads       Lead[]
}

model Search {
  id           String   @id @default(cuid())
  agentId      String
  criteria     Json
  createdAt    DateTime @default(now())
  agent        User     @relation(fields:[agentId], references:[id])
}

model ChatMessage {
  id        String   @id @default(cuid())
  agentId   String
  role      String
  content   String   @db.Text
  createdAt DateTime @default(now())
  agent     User     @relation(fields:[agentId], references:[id])
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL=mysql://user:pass@railway.internal:3306/leadpulse

# Auth
JWT_SECRET=

# Google Gemini
GOOGLE_AI_API_KEY=
GOOGLE_AI_PROJECT_ID=
GOOGLE_AI_LOCATION=us-central1
GOOGLE_AI_MODEL=gemini-1.0

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# Bitrix24
BITRIX24_WEBHOOK_URL=
BITRIX24_DOMAIN=

# WhatsApp Business
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# Scraper
SCRAPER_SERVICE_URL=
SCRAPER_SECRET=
```

---

## Developer scripts & local testing

- **Validate required secrets**: quick check to ensure required environment variables are present. Run with `tsx` (no build step). Examples:

  - PowerShell (Windows):

    ```powershell
    $env:SCRAPER_SERVICE_URL='https://example.com'; $env:SCRAPER_SECRET='your_secret'; npx tsx scratch/validate-secrets.ts
    ```

  - macOS / Linux:

    ```bash
    SCRAPER_SERVICE_URL=https://example.com SCRAPER_SECRET=your_secret npx tsx scratch/validate-secrets.ts
    ```

- **Smoke test (production endpoints)**: runs basic health and API checks against configured `SCRAPER_SERVICE_URL` and `VERCEL_URL`.

  - PowerShell:

    ```powershell
    $env:SCRAPER_SERVICE_URL='https://scraper.example.com'; $env:VERCEL_URL='https://your-app.vercel.app'; $env:SCRAPER_SECRET='your_secret'; npx tsx scratch/smoke-test-prod.ts
    ```

  - macOS / Linux:

    ```bash
    SCRAPER_SERVICE_URL=https://scraper.example.com VERCEL_URL=https://your-app.vercel.app SCRAPER_SECRET=your_secret npx tsx scratch/smoke-test-prod.ts
    ```

- **Run scraper service in mock mode (no external web requests)**: useful for developing the Next.js frontend and pipelines without consuming proxy bandwidth or triggering real scrapes.

  - PowerShell (Windows):

    ```powershell
    $env:USE_MOCK_DATA='true'; node scraper-service/index.js
    ```

  - macOS / Linux:

    ```bash
    USE_MOCK_DATA=true node scraper-service/index.js
    ```

  When `USE_MOCK_DATA=true`, the scraper will return simulated lead data for all sources and skip launching Playwright browsers.

---

## Project Structure

```
leadpulse-uae/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (app)/
│   │   ├── leads/
│   │   ├── map/
│   │   ├── search/
│   │   ├── campaigns/
│   │   └── settings/
│   │       ├── profile/
│   │       ├── scraper/
│   │       ├── integrations/
│   │       └── notifications/
│   └── api/
│       ├── leads/
│       ├── scrape/
│       ├── export/
│       ├── ai/pitch/
│       ├── ai/chat/
│       ├── bitrix24/
│       └── cron/scrape/
├── components/
│   ├── leads/
│   │   ├── LeadTable.tsx
│   │   ├── LeadSidebar.tsx
│   │   ├── ScoreBadge.tsx
│   │   ├── TierBadge.tsx
│   │   └── SignalChip.tsx
│   ├── map/
│   │   └── EmirateMap.tsx
│   ├── search/
│   │   └── QualificationForm.tsx
│   ├── chat/
│   │   └── AgentChatbot.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── NavSidebar.tsx
│   │   └── TopBar.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Badge.tsx
│       └── Modal.tsx
├── lib/
│   ├── prisma.ts
│   ├── ai.ts
│   ├── bitrix24.ts
│   ├── whatsapp.ts
│   ├── scraper-client.ts
│   ├── scoring.ts
│   └── ml/
│       └── lead-model.ts
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── scraper/              ← Railway service
│   ├── index.ts
│   ├── sources/
│   │   ├── bayut.ts
│   │   ├── dubizzle.ts
│   │   ├── zawya.ts
│   │   ├── adgm.ts
│   │   ├── ded.ts
│   │   ├── forbes-me.ts
│   │   ├── bloomberg-mena.ts
│   │   └── elite-lifestyle.ts
│   └── utils/
│       ├── proxy.ts
│       └── dedup.ts
├── prisma/
│   └── schema.prisma
├── styles/
│   └── tokens.css
├── i18n/
│   ├── en.json
│   └── ar.json
└── design-system.md
```

---

## Integrations

### Bitrix24 — Simplified REST Integration (3 phases)

No webhooks, no bidirectional sync initially. Complexity added only after the basic push is stable.

**Phase A — Push leads as contacts (launch scope)**
```
POST https://{domain}.bitrix24.ae/rest/crm.contact.add
```
```ts
// lib/bitrix24.ts
export async function pushContact(lead: Lead) {
  const res = await fetch(
    `${process.env.BITRIX24_DOMAIN}/rest/crm.contact.add.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth: process.env.BITRIX24_TOKEN,
        fields: {
          NAME:         lead.name,
          LAST_NAME:    lead.company,
          PHONE:        [{ VALUE: lead.phone, VALUE_TYPE: "WORK" }],
          EMAIL:        [{ VALUE: lead.email, VALUE_TYPE: "WORK" }],
          COMMENTS:     `Score: ${lead.score} | Tier: ${lead.tier} | Signals: ${lead.signals.join(", ")}`,
        },
      }),
    }
  );
  return res.json();
}
```

**Phase B — Push as Deal (post-launch, after Phase A is stable)**
```
POST https://{domain}.bitrix24.ae/rest/crm.deal.add
```
Link the deal to the contact created in Phase A. Add property type, budget, and emirate as deal fields.

**Phase C — Bidirectional sync (optional, only if agents request it)**
Inbound webhook from Bitrix24 → update lead status in MySQL.
Only implement if agents are actively managing deals inside Bitrix24 and need status to reflect back in LeadPulse.

### WhatsApp Business Cloud API
- Send approved message templates to leads directly from the lead sidebar
- Inbound reply webhook → surface in app notification (Phase C equivalent — post-launch)
- Connected to Bitrix24 contact record via shared phone number

### Settings → Integrations Page
```
Bitrix24 Domain   [yourcompany.bitrix24.ae]
API Token         [______________________ ]
[ Test connection ]   [ Save ]

Push mode:        ● Contacts only (recommended)
                  ○ Contacts + Deals
                  ○ Off
```

### Reference Portals (for scraping inspiration)
- [opr.ae/map](https://opr.ae/map) — property map UI reference
- [opr.ae/video-overviews](https://opr.ae/video-overviews) — media overlay reference

---

## Distribution

### Strategy — No App Store Required

LeadPulse UAE is distributed directly to agents. No Play Store, no App Store, no review process, no annual fees.

| Platform | Method | Cost | Store |
|----------|--------|------|-------|
| Desktop (Windows / Mac / Linux) | Install PWA from browser via install prompt | Free | No |
| Android | Sideload signed `.apk` from download link | Free | No |
| iOS | Safari → Share → Add to Home Screen | Free | No |

Every new agent receives an onboarding message with a single link to `/install`. The page auto-detects their device and shows the correct installation flow.

---

### `/install` — Agent Onboarding Page

Route: `app/(app)/install/page.tsx` — **public, no auth required**

Device detection via `navigator.userAgent` on load. Three panels:

**Android** — "Download App" button → Vercel Blob APK URL. One tap, sideload directly. Agent enables "Install from unknown sources" once on their device.

**iOS** — 4-step visual guide:
1. Open this link in **Safari** (not Chrome)
2. Tap the **Share** icon
3. Tap **Add to Home Screen**
4. Tap **Add** — LeadPulse appears on your home screen

**Desktop** — "Install from browser" button triggering the intercepted `beforeinstallprompt` event.

Page is fully bilingual EN/AR with RTL layout. Includes a QR code linking to `/install` itself for sharing via WhatsApp or email.

---

### Android APK — Technical Notes

- Generated via **PWABuilder** (Trusted Web Activity — full Chrome engine, not WebView)
- Requires Lighthouse PWA score ≥ 80 before packaging
- Requires `/.well-known/assetlinks.json` on Vercel for TWA domain verification
- `.apk` hosted on **Vercel Blob** — stable download URL never changes
- Re-generate on each major version release

### iOS — Technical Notes

- **Must use Safari** — Chrome on iOS cannot trigger Add to Home Screen
- Requires `apple-touch-icon` meta tags in `app/layout.tsx` (iOS ignores manifest icons)
- Requires `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags
- Push notifications work on iOS 16.4+ only after Home Screen install — opt-in rates are low; not a primary notification channel for this app
- Tested on iOS 16, 17, and 18

---
- English (LTR) — `en`
- Arabic / العربية (RTL) — `ar`
- All UI strings, AI responses, signals, roles, and locations translated

---

## Deployment & Validation Scripts

### Running Validation & Smoke Tests Locally

The project includes two TypeScript utilities in `scratch/` for validating deployment and production readiness:

#### 1. **Validate Environment Secrets** (`scratch/validate-secrets.ts`)

Validates that all required production environment variables are present and correctly formatted:

```bash
# Install tsx globally (if not already installed)
npm install -g tsx

# Run validation with your environment variables loaded
USE_MOCK_DATA=true tsx scratch/validate-secrets.ts
```

**Checks:**
- `DATABASE_URL` — Railway MySQL connection string
- `SCRAPER_SERVICE_URL` — Internal scraper service endpoint
- `SCRAPER_SECRET` — 64-character hex string used for service authentication
- `DATAIMPULSE_PROXY_URL`, `DATAIMPULSE_PROXY_USERNAME`, `DATAIMPULSE_PROXY_PASSWORD` — Proxy credentials
- At least one AI provider key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, etc.)

**Output:**
```
✅ Required environment variables are present.
✅ SCRAPER_SECRET is valid (64 chars).
✅ At least one AI provider key is configured.
```

#### 2. **Smoke Test Production** (`scratch/smoke-test-prod.ts`)

Performs end-to-end connectivity tests against production endpoints:

```bash
# Set environment variables and run smoke tests
export SCRAPER_SERVICE_URL=https://scraper-service.railway.app
export VERCEL_URL=https://your-vercel-project.vercel.app
export SCRAPER_SECRET=<your-64-char-hex>
export DATAIMPULSE_PROXY_USERNAME=<if-configured>
export DATAIMPULSE_PROXY_PASSWORD=<if-configured>
export DATAIMPULSE_PROXY_URL=<if-configured>

tsx scratch/smoke-test-prod.ts
```

**Tests:**
1. GET `/health` — Verifies scraper service is running
2. POST `/api/scrape` — Tests Vercel Next.js API route with auth header
3. Proxy connectivity — If DataImpulse credentials present, validates proxy tunnel

**Output:**
```
✅ Scraper service health passed.
✅ Vercel scrape endpoint returned success.
```

---

### Local Development with Mock Data

To test the UI without triggering real web scrapes or proxy requests:

```bash
# Start scraper service in mock mode
USE_MOCK_DATA=true node scraper-service/index.js

# In a separate terminal, start the Next.js app
npm run dev
```

When `USE_MOCK_DATA=true`:
- Scraper endpoints return simulated lead data (no real Playwright calls)
- No external API calls or proxy bandwidth consumed
- Perfect for UI testing and frontend development
- Mock data includes realistic lead profiles with signals and budgets

---

### Proxy Connectivity Validation (`scraper-service/proxy-validator.js`)

The scraper service includes a built-in proxy validation utility used by the `/validate-proxy` endpoint:

```bash
# From the root directory, test proxy configuration
curl -X POST http://localhost:3002/validate-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "secret": "'$SCRAPER_SECRET'",
    "proxyUrl": "'$DATAIMPULSE_PROXY_URL'"
  }'
```

**Response example (connected):**
```json
{
  "status": "connected",
  "configured": true,
  "details": {
    "responseTime": 1247,
    "testUrl": "https://httpbin.org/ip",
    "responsePreview": "{\"origin\": \"1.2.3.4\"}"
  }
}
```

**Response example (failed):**
```json
{
  "status": "failed",
  "configured": true,
  "error": "407 Proxy Authentication Failed",
  "suggestions": [
    "HTTP 407 Proxy Authentication Failed — verify username/password are URL-encoded",
    "Check DATAIMPULSE_PROXY_USERNAME and DATAIMPULSE_PROXY_PASSWORD values"
  ]
}
```

The validator:
- Attempts real page load through configured proxy
- Provides detailed error codes and diagnostic suggestions
- Helps troubleshoot DataImpulse or other proxy provider issues
- Safe to run repeatedly without side effects

---

## License

Private — internal tooling for real estate sales teams.

## ALL RIGHTS RESERVED FOR ALMSTKSHF FOR MEDIA MONITORING AND DEVELOPMENT 
HTTPS://ALMSTKSHF.COM
TECH TEAM: +971585952035
