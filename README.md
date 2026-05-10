# Real-Estate-Lead-Scraper
A browser-based tool that simulates scraping and aggregating potential buyer leads from three source types — property portals (Bayut, Dubizzle), business directories, and news/press releases — then surfaces them as a clean, filterable leads table.
# LeadPulse UAE
### Find the right buyer, faster — اعثر على المشتري المناسب بشكل أسرع

A full-stack real estate lead intelligence platform for UAE agents. Scrapes, scores, qualifies, and pushes buyer leads from 11+ premium sources into Bitrix24 CRM with AI-powered pitch generation, WhatsApp Business outreach, and bilingual EN/AR support.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + CSS variables (design system tokens) |
| Auth | Built-in login (JWT + bcrypt) — no third-party auth service |
| Database | Railway MySQL via Prisma ORM |
| File storage | Vercel Blob (exports, scraped snapshots, lead attachments) |
| Scheduling | Vercel Cron (daily scrape jobs) |
| AI | Anthropic Claude API — `claude-sonnet-4-20250514` |
| Chatbot | Claude API with conversation memory (stored in MySQL) |
| ML | TensorFlow.js — in-app learning from agent behavior and lead outcomes |
| Scraper | Node.js + Playwright (server-side, Railway hosted) |
| CRM | Bitrix24 REST API |
| Messaging | WhatsApp Business Cloud API |
| Deployment | Vercel (frontend + API routes) + Railway (scraper service + MySQL) |
| PWA / APK | PWABuilder — Android APK + iOS Add to Home Screen (no app store) |
| i18n | next-i18next — EN/AR, RTL/LTR via `<html dir>` |
| Map | Custom SVG UAE emirate map (no external map library) |

---

## Lead Qualification Criteria

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
- **AI pitch generation** — Claude API, responds in EN or AR based on active language
- **AI chatbot** — persistent, memory-aware assistant for agents (conversation stored in MySQL)
- **ML lead scoring** — TensorFlow.js model trained on historical lead outcomes and agent interactions; improves over time
- **AI signal extraction** — Claude API parses scraped raw text to assign signals automatically

### Scraper
- Sources: Bayut, Dubizzle, Zawya Invest, Bloomberg MENA, Forbes ME, ADGM/DIFC Registry, DED Registry, Private Banking directories, Family Office networks, Elite Lifestyle/Concierge, News & Press
- Playwright (Node.js) — headless, proxy-rotated
- Incremental scrape — new leads appended, previous data never overwritten
- Optional: save selected leads only (agent manually flags before committing to DB)
- Vercel Cron: daily at 02:00 GST
- Scrape history log stored in MySQL

### Export
- CSV (UTF-8 BOM, bilingual EN/AR columns)
- XLSX (native, no library, bold headers, auto-width)
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
  id            String   @id @default(cuid())
  name          String
  nameAr        String?
  company       String
  companyAr     String?
  role          String
  roleAr        String?
  source        String
  tier          Int
  phone         String?
  email         String?
  location      String
  score         Int
  signals       Json
  propertyPref  Json
  budgetMin     Float?
  budgetMax     Float?
  relocated     Boolean  @default(false)
  rentalFlag    Boolean  @default(false)
  status        String   @default("new")
  notes         String?
  agentId       String
  scrapeRunId   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  agent         User     @relation(fields:[agentId], references:[id])
  scrapeRun     ScrapeRun @relation(fields:[scrapeRunId], references:[id])
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

# Anthropic
ANTHROPIC_API_KEY=

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
│   ├── claude.ts
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

### Bitrix24
- REST API via webhook
- Push leads as Contacts + Deals
- Sync deal stage bidirectionally
- Trigger campaigns from the app

### WhatsApp Business Cloud API
- Send approved message templates to leads
- Inbound message webhook → surface replies in app
- Linked to Bitrix24 contact record

### Reference Portals (for scraping inspiration)
- [opr.ae/map](https://opr.ae/map) — property map UI reference
- [opr.ae/video-overviews](https://opr.ae/video-overviews) — media overlay reference

---

## Languages
- English (LTR) — `en`
- Arabic / العربية (RTL) — `ar`
- All UI strings, AI responses, signals, roles, and locations translated

---

## License
Private — internal tooling for real estate sales teams.
