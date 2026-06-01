# Implementation Tracker — UAE Real Estate Lead Scraper

## Phase 0: Foundation & Core Infrastructure 🏗️
- [x] Next.js 14 App Router Setup (Bilingual EN/AR)
- [x] Tailwind + Custom Design System Tokens
- [x] Database setup (Railway MySQL + Prisma)
- [x] **Hardened**: Fixed Scraper Service URL and added API secret logic.
- [x] **Hardened**: Scraper service architecture (Decoupled Node.js).
- [x] **Hardened**: Secure Scraper communication (Shared Secret).
- [x] **Hardened**: Fixed Prisma initialization crash during Next.js static build evaluation.

## Phase 1: Authentication & Layout 🔐
- [x] Login page (multi-language support)
- [x] App shell (TopBar + NavSidebar)
- [x] Theme toggle (Light/Dark)
- [x] Mobile navigation drawer (Responsive EN/AR)
- [x] **Hardened**: JWT-based secure session management.
- [x] **Hardened**: RBAC implemented (relaxed to allow agents for scrapes).

## Phase 2: High-Value Lead Discovery 🔍
- [x] Global UAE Real Estate Search Interface
- [x] Smart Filtering (Budget, Location, Intent)
- [x] Lead Intelligence Table (Bilingual)
- [x] AI Signal chips implementation
- [x] **Hardened**: Replaced mock data with real API data from database.

## Phase 3: Scraper Logic & Persistence 🕷️
- [x] Scrape initialization trigger
- [x] Criteria persistence (MySQL Search table)
- [x] **Hardened**: Scrape Run persistence (Prisma ScrapeRun model).
- [x] **Hardened**: RTL/Localization Parity for Search Form & Sidebar.
- [x] **Hardened**: Job Status tracking foundation.

## Phase 4: Lead Management & Pipeline 📊 (COMPLETED)
- [x] Pipeline View (Kanban) with actual Drag-and-drop (@hello-pangea/dnd)
- [x] **Hardened**: Optimistic status updates with automatic rollback on failure.
- [x] **Hardened**: Global Filtering (Search, Status, Tier) synchronized across views.
- [x] **Hardened**: Bulk Management (Multi-select, Mass update, CRM Push simulation).
- [x] **Hardened**: Real-time notifications loop (Sonner toasts).
- [x] **Hardened**: Professional XLSX Export with active filter respect.
- [x] **Hardened**: Leads API parameter validation and case-insensitive role parity.
- [x] **Hardened**: 27 realistic UAE demo leads seeded (T1/T2/T3, bilingual EN/AR).
- [x] **Hardened**: Scrape button replaced alert() with Sonner toast (loading → success/warning/error).
- [x] **Hardened**: Arabic i18n full parity — added all missing keys, fixed hardcoded EN strings in Pipeline/Sidebar/Filters.
- [x] Custom lead notes persistence (MySQL Sync).
- [x] **Hardened**: Bulk action bar fully translated (leadsSelected, markContacted, pushBitrix, delete keys).
- [x] **Hardened**: Pagination buttons (Previous/Next) fully translated EN/AR.
- [x] **Hardened**: Lead detail "role at company" row uses i18n roleAt key (EN/AR).
- [x] **Hardened**: AI Pitch template fixed — was rendering literal `{t(...)}` string; now correctly interpolates lead name & company.
- [x] **Hardened**: AI Pitch "Copy Pitch" button functional — copies generated pitch text to clipboard with ✓ feedback.
- [x] **Hardened**: Bitrix24 "Push" button fires Sonner success toast after simulation completes.
- [x] **Hardened**: Recent Activity text in lead sidebar translated (recentActivityText key, EN/AR).

## Phase 5: Map View & Geo-Intelligence 📍 (COMPLETED)
- [x] **Leaflet.js map integration** — dark-themed CARTO base map covering entire UAE with zoom controls.
- [x] **Lead clustering by UAE location** — 25+ UAE area coordinates database; single leads = animated score marker (tier-colored), groups = cluster badge showing lead count.
- [x] **Demand heatmap layer** — score × tier weighted heat circles per area; toggle between Lead Clusters and Demand Heatmap via layer switcher.
- [x] **Geo-fencing for target scrapes** — click-drag rectangle draw tool on map; filters leads inside drawn bounds and lists them in Zone Leads panel.
- [x] **Map Stats sidebar** — Total Leads, Avg Score, Elite (T1) count, In-Zone count; Hot Zones bar chart (top 3 locations by lead density).
- [x] **Floating Lead Detail panel** — on marker click shows score circle, name, company, tier badge, status, budget range, signal chips; fully bilingual.
- [x] **Global filters on map** — Tier, Status, Min Score (slider) filters drive live API fetch; refresh button with spinner.
- [x] **Geofence UX** — instructional banner while drawing; success banner with lead count after draw; Clear Zone button.
- [x] **Legend panel** — tier colors + score colors reference guide.
- [x] **Full EN/AR i18n** — all map keys added to both locales; RTL-safe inset-inline-start positioning for floating panel.

## Phase 6 — AI Features ✅ (COMPLETED)

- [x] **AI pitch API route (`/api/ai/pitch`)** — Gemini API, EN/AR prompt
- [x] **Pitch renders in sidebar inline**

- [x] **Pitch language follows active UI language**
- [x] **AI signal extraction** — parse scraped text → assign signals
- [x] **Chatbot component (`AgentChatbot`)** — Floating, persistent
- [x] **Chatbot memory stored in MySQL** — Full conversation history per agent
- [x] **Chatbot API route (`/api/ai/chat`)** — Passes history each call
- [x] **Chatbot EN/AR** — responds in active language
- [x] **ML model: TensorFlow.js** — train on lead outcomes (Start after 500+ leads in DB)
- [x] **ML: adjust base score weights based on agent feedback** — Won/Lost signals feed model

---

## Phase 7 — Scraper Service Architecture Evolution 🎯

> **Architecture Clarification**: Reliance on expensive, paid third-party scrapers (Apify, Apollo, SerpAPI) has been completely removed to save 95% in costs. The system has successfully transitioned to our own **Internal Playwright-based Scraper Service** (running on Railway/locally) which harvests a high-quality "Golden Dataset" local database, enriched by Gemini AI.

### 7A-7F — Legacy Integrations [REMOVED]
- [x] Apify integration (Removed)
- [x] SerpAPI news (Removed)
- [x] Public Registry (Removed)
- [x] Apollo Prospecting (Removed)

## Phase 8 — Export ✅ (COMPLETED)
- [x] 8A.1 Standardize export fields (EN/AR parity) <!-- id: 8A.1 -->
- [x] 8A.2 Fix ExcelJS/CSV export routes <!-- id: 8A.2 -->
- [x] 8B.1 Integrate Vercel Blob for secure CSV/Excel storage <!-- id: 8B.1 -->
- [x] 8B.2 Implement Scraper log storage in Vercel Blob <!-- id: 8B.2 -->
- [x] 8C.1 Align Import mapping with Export headers (Reverse Fix) <!-- id: 8C.1 -->
- [x] 8C.2 Create Export/Import Guide <!-- id: 8C.2 -->

- [x] **CSV export (UTF-8 BOM, bilingual)** — Respects active filters
- [x] **XLSX export (native, bold headers)**
- [x] **Save export to Vercel Blob + return download URL**
- [x] **Export history page in Settings**


---

## Phase 9 — CRM & Outreach 🔲

> Bitrix24 integration is split into 3 phases. Never skip to Phase B or C until the previous phase is confirmed stable in production.

### Phase 9A — Contacts Push (Launch scope) 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9A.1 | `lib/bitrix24.ts` — `pushContact()` using `crm.contact.add` | ✅ Done | High | Single endpoint, no webhooks |
| 9A.2 | "Push to Bitrix24" button in lead sidebar | ✅ Done | High | One-click per lead |
| 9A.3 | Bulk push — selected leads from table | ✅ Done | High | Checkbox select + push action |
| 9A.4 | Push confirmation + error handling in UI | ✅ Done | High | Show success/fail per lead |
| 9A.5 | Store `bitrix24ContactId` on Lead record in MySQL | ✅ Done | Medium | Prevents duplicate pushes |
| 9A.6 | Settings page — Bitrix24 domain + token + test connection | ✅ Done | High | Validate before saving |
| 9A.7 | WhatsApp Business API client (`lib/whatsapp.ts`) | ✅ Done | High | Send template messages |
| 9A.8 | Send WhatsApp message from lead sidebar | ✅ Done | High | Uses lead phone number |
| 9A.9 | Email outreach — compose + send via SMTP | ✅ Done | Medium | Resend or nodemailer |

### Phase 9B — Deals Push (Post-launch, after 9A stable) 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9B.1 | `pushDeal()` using `crm.deal.add` — linked to contact | ✅ Done | Medium | Add after 9A confirmed working |
| 9B.2 | Map property type + budget + emirate → Bitrix24 deal fields | ✅ Done | Medium | |
| 9B.3 | Settings: push mode toggle (Contacts only / Contacts + Deals) | ✅ Done | Medium | Default: Contacts only |
| 9B.4 | Campaign manager view — group leads by property type or tier | 🔲 Todo | Medium | |
| 9B.5 | Bitrix24 calendar sync — schedule follow-ups | 🔄 In progress | Low | |

### Phase 9C — Bidirectional Sync (Optional, only if agents request it) 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9C.1 | Inbound Bitrix24 webhook → update lead status in MySQL | 🔲 Todo | Low | Only if agents manage deals in Bitrix24 |
| 9C.2 | WhatsApp inbound reply webhook → surface in app | 🔲 Todo | Low | |
| 9C.3 | Bitrix24 app integrations (task importer, SPA importer, 2-way SMS) | 🔲 Todo | Low | Only if explicitly requested |

---

## Phase 10 — Settings Interface 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 10.1 | Settings shell + nav | ✅ Done | High | |
| 10.2 | Profile settings (name, language, theme) | ✅ Done | High | |
| 10.3 | Scraper config (sources on/off, schedule, criteria defaults) | ✅ Done | High | |
| 10.4 | Integrations page (Bitrix24, WhatsApp, SMTP) | ✅ Done | High | Connect / disconnect |
| 10.5 | Notification preferences | ✅ Done | Low | |

---

## Phase 11 — PWA & Distribution 🔲

### 11A — PWA Foundation 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11A.1 | `manifest.json` — name, short_name, theme_color `#185FA5`, background_color `#F7F8FA`, display `standalone` | ✅ Done | High | |
| 11A.2 | App icons — 192×192 and 512×512 PNG, maskable variant for Android | ✅ Done | High | EN + AR wordmark variants |
| 11A.3 | Service worker — cache app shell + last lead dataset offline | ✅ Done | Medium | Use Workbox or hand-rolled |
| 11A.4 | Offline fallback page — shows last cached leads, blocks new scrape | ✅ Done | Medium | |
| 11A.5 | Browser install prompt — intercept `beforeinstallprompt`, show custom UI | 🔲 Todo | Medium | Desktop + Android Chrome |

### 11B — Android APK 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11B.1 | Verify Lighthouse PWA score ≥ 80 before packaging | 🔲 Todo | High | Required for valid TWA |
| 11B.2 | Generate `.apk` + `.aab` via PWABuilder (TWA) | 🔲 Todo | High | pwabuilder.com — no Play Store needed |
| 11B.3 | Set up `assetlinks.json` at `/.well-known/assetlinks.json` on Vercel | 🔲 Todo | High | Required for TWA domain verification |
| 11B.4 | Host signed `.apk` on Vercel Blob — generate stable download URL | 🔲 Todo | High | Agents download directly, no Play Store |
| 11B.5 | Test sideload install on Android 10, 12, 14 | 🔲 Todo | Medium | Confirm "Install from unknown sources" flow |
| 11B.6 | Re-generate APK on each major version release | 🔲 Todo | Medium | Add to release checklist |

### 11C — iOS Installation 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11C.1 | Test Add to Home Screen on iOS 16, 17, 18 via Safari | 🔲 Todo | High | Must use Safari — Chrome on iOS will not prompt |
| 11C.2 | Confirm standalone fullscreen mode on iPhone + iPad | 🔲 Todo | High | `display: standalone` in manifest |
| 11C.3 | Add `apple-touch-icon` meta tags in `app/layout.tsx` | ✅ Done | High | iOS ignores manifest icons — needs own tag |
| 11C.4 | Add `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags | ✅ Done | Medium | Controls status bar appearance |
| 11C.5 | Test push notifications on iOS (requires Home Screen install) | 🔲 Todo | Low | iOS 16.4+ only, opt-in rates low |

### 11D — Agent Onboarding Install Page 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11D.1 | Create `/install` route in `app/(app)/install/page.tsx` | ✅ Done | High | Public route — no auth required |
| 11D.2 | Device detection — auto-detect Android / iOS / Desktop on load | ✅ Done | High | Use `navigator.userAgent` — no library needed |
| 11D.3 | Android panel — "Download App" button linking to Vercel Blob APK URL | 🔲 Todo | High | One tap install |
| 11D.4 | iOS panel — 4-step visual guide: Open in Safari → Tap Share → Add to Home Screen → Open LeadPulse | ✅ Done | High | Screenshots in AR + EN |
| 11D.5 | Desktop panel — "Install from browser" button triggering PWA install prompt | 🔲 Todo | Medium | Uses intercepted `beforeinstallprompt` |
| 11D.6 | `/install` page in EN + AR with full RTL layout | ✅ Done | High | First page many agents will see |
| 11D.7 | QR code on `/install` page linking to itself — for sharing in WhatsApp/email | ✅ Done | Medium | Generate via `qrcode` npm package |
| 11D.8 | Add `/install` link to agent onboarding email template | 🔲 Todo | Medium | Sent when admin creates a new agent account |

## Phase 12 — Static Data Pivot & AI Persona 🚀

- [x] **Decommission External Services** — Removed Apify, Apollo, SerpAPI.
- [x] **Internal Playwright Engine** — Fully activated our local scraper-service to extract local source data.
- [x] **Unlimited Result Extraction** — Removed "25 leads" hardcoded limit.
+ [x] **Gemini Persona Field** — Added `persona` column to Lead model in MySQL.
+ [x] **Deep Persona Analysis** — Integrated Gemini logic to analyze behavior and investor profiles.
- [x] **Ingestion Failure Resilience** — Local/Railway scraper-service model ensures 100% data availability without paid API timeouts.

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Done | Complete and live |
| 🔲 Todo | Not started |
| 🔄 In progress | Currently being built |
| ⏸ Blocked | Waiting on dependency |
