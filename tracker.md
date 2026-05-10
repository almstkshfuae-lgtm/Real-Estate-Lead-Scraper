# Implementation Tracker — LeadPulse UAE
> Last updated: May 2026 — Total tasks: 98

---

## Phase 0 — Project Setup 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 0.1 | Init Next.js 14 + TypeScript repo | 🔲 Todo | High | `create-next-app --typescript` |
| 0.2 | Configure Tailwind CSS + design token CSS variables | 🔲 Todo | High | From `design-system.md` |
| 0.3 | Set up Railway MySQL + Prisma schema | 🔲 Todo | High | See schema in README |
| 0.4 | Connect Vercel project + env vars | 🔲 Todo | High | |
| 0.5 | Set up Vercel Blob | 🔲 Todo | High | For exports + snapshots |
| 0.6 | Set up i18n (next-i18next) EN + AR | 🔲 Todo | High | RTL on `<html dir>` |
| 0.7 | Configure Arabic font (Cairo/Tajawal) + Inter for EN | 🔲 Todo | High | Google Fonts or self-hosted |
| 0.8 | PWA manifest + service worker skeleton | 🔲 Todo | Medium | |
| 0.9 | Linting, Prettier, path aliases, strict TS config | 🔲 Todo | Medium | |
| 0.10 | Set up Railway scraper service (Node.js + Playwright) | 🔲 Todo | High | Separate repo or monorepo |

---

## Phase 1 — Auth & User Management 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 1.1 | Login page UI (email + password) | 🔲 Todo | High | EN/AR, responsive |
| 1.2 | JWT auth (sign, verify, refresh) | 🔲 Todo | High | Stored in httpOnly cookie |
| 1.3 | Password hashing (bcrypt) | 🔲 Todo | High | |
| 1.4 | Protected route middleware | 🔲 Todo | High | `middleware.ts` |
| 1.5 | User roles (admin, agent) | 🔲 Todo | Medium | |
| 1.6 | Seed first admin user via script | 🔲 Todo | High | |

---

## Phase 2 — Design System & UI Shell 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 2.1 | Build token CSS file (`styles/tokens.css`) | 🔲 Todo | High | All color + spacing tokens |
| 2.2 | Build `Button`, `Input`, `Select`, `Badge`, `Modal` components | 🔲 Todo | High | |
| 2.3 | Build `AppShell` + `NavSidebar` (EN left / AR right) | 🔲 Todo | High | |
| 2.4 | Build `TopBar` with EN/AR toggle + dark mode switch | 🔲 Todo | High | |
| 2.5 | Responsive breakpoints (sm / md / lg / xl) | 🔲 Todo | High | |
| 2.6 | Dark mode token swap via `data-theme="dark"` | 🔲 Todo | Medium | |
| 2.7 | RTL logical CSS audit — no `margin-left`, `padding-right` hardcoded | 🔲 Todo | High | |
| 2.8 | Directional icon mirroring (chevrons, arrows) in RTL | 🔲 Todo | Medium | `scaleX(-1)` |

---

## Phase 3 — Lead Qualification Search 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 3.1 | `QualificationForm` component | 🔲 Todo | High | Before each scrape |
| 3.2 | Property type multi-select (apartment/villa/townhouse/penthouse/commercial) | 🔲 Todo | High | |
| 3.3 | Budget range slider + AED manual input | 🔲 Todo | High | `from` / `to` |
| 3.4 | Recently relocated toggle | 🔲 Todo | Medium | |
| 3.5 | Exclude rental behavior toggle | 🔲 Todo | High | |
| 3.6 | Target emirate(s) multi-select | 🔲 Todo | Medium | |
| 3.7 | Signal filter + tier minimum | 🔲 Todo | Medium | |
| 3.8 | Save search criteria to MySQL (`Search` table) | 🔲 Todo | Medium | |
| 3.9 | Load previous search as preset | 🔲 Todo | Low | |

---

## Phase 4 — Lead Table & UI 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 4.1 | `LeadTable` component — all columns | 🔲 Todo | High | Score, tier, source, signals, contact |
| 4.2 | `ScoreBadge` — color-coded circle | 🔲 Todo | High | |
| 4.3 | `TierBadge` — T1/T2/T3 chip | 🔲 Todo | High | |
| 4.4 | `SignalChip` — per signal color | 🔲 Todo | High | |
| 4.5 | Filters: tier, source, signal, location, budget, property type | 🔲 Todo | High | |
| 4.6 | Free-text search (name + company) | 🔲 Todo | High | |
| 4.7 | Sort by score / name / date added | 🔲 Todo | Medium | |
| 4.8 | `LeadSidebar` — RTL-aware detail panel | 🔲 Todo | High | |
| 4.9 | Copy phone/email on click | 🔲 Todo | Medium | |
| 4.10 | Lead status dropdown (New/Contacted/Qualified/Won/Lost) | 🔲 Todo | High | Saved to MySQL |
| 4.11 | Notes field per lead | 🔲 Todo | Medium | Inline in sidebar |
| 4.12 | Optional save selected leads before committing to DB | 🔲 Todo | High | Agent manually flags |

---

## Phase 5 — UAE Map View 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 5.1 | `EmirateMap` SVG component | 🔲 Todo | Medium | All 7 emirates + DIFC + ADGM zones |
| 5.2 | Lead density color coding per emirate | 🔲 Todo | Medium | Opacity scale |
| 5.3 | Click emirate → filter lead table | 🔲 Todo | Medium | |
| 5.4 | Emirate label EN/AR toggle | 🔲 Todo | Medium | |
| 5.5 | Legend with lead counts | 🔲 Todo | Low | |

---

## Phase 6 — AI Features 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 6.1 | AI pitch API route (`/api/ai/pitch`) | 🔲 Todo | High | Claude API, EN/AR prompt |
| 6.2 | Pitch renders in sidebar inline | 🔲 Todo | High | |
| 6.3 | Pitch language follows active UI language | 🔲 Todo | High | |
| 6.4 | AI signal extraction — parse scraped text → assign signals | 🔲 Todo | High | Claude API batch |
| 6.5 | Chatbot component (`AgentChatbot`) | 🔲 Todo | High | Floating, persistent |
| 6.6 | Chatbot memory stored in MySQL (`ChatMessage` table) | 🔲 Todo | High | Full conversation history per agent |
| 6.7 | Chatbot API route (`/api/ai/chat`) | 🔲 Todo | High | Passes history each call |
| 6.8 | Chatbot EN/AR — responds in active language | 🔲 Todo | Medium | |
| 6.9 | ML model: TensorFlow.js — train on lead outcomes | 🔲 Todo | Low | Start after 500+ leads in DB |
| 6.10 | ML: adjust base score weights based on agent feedback | 🔲 Todo | Low | Won/Lost signals feed model |

---

## Phase 7 — Scraper Backend 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 7.1 | Scraper service scaffold (Railway, Node.js + Playwright) | 🔲 Todo | High | |
| 7.2 | Proxy rotation + rate limiting | 🔲 Todo | High | Required for portals |
| 7.3 | Scrape Bayut | 🔲 Todo | High | Check ToS |
| 7.4 | Scrape Dubizzle | 🔲 Todo | High | Check ToS |
| 7.5 | Scrape Zawya Invest | 🔲 Todo | High | |
| 7.6 | Scrape ADGM / DIFC public registry | 🔲 Todo | High | Public data |
| 7.7 | Scrape DED commercial license registry | 🔲 Todo | Medium | |
| 7.8 | Scrape Forbes ME wealth lists | 🔲 Todo | Medium | |
| 7.9 | Scrape Bloomberg MENA executive mentions | 🔲 Todo | Medium | |
| 7.10 | Elite lifestyle / concierge source list (manual curation) | 🔲 Todo | Low | |
| 7.11 | Lead deduplication (phone + email + name match) | 🔲 Todo | High | |
| 7.12 | Incremental scrape — append only, never overwrite | 🔲 Todo | High | |
| 7.13 | Scrape run log to MySQL (`ScrapeRun` table) | 🔲 Todo | High | |
| 7.14 | Vercel Cron trigger at 02:00 GST daily | 🔲 Todo | High | `/api/cron/scrape` |
| 7.15 | Criteria-aware scraper (property type, budget, location filter) | 🔲 Todo | High | Pass `Search` criteria to scraper |
| 7.16 | Rental behavior detection + exclusion logic | 🔲 Todo | Medium | |
| 7.17 | Recently relocated detection (registry date, LinkedIn signal) | 🔲 Todo | Medium | |

---

## Phase 8 — Export 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 8.1 | CSV export (UTF-8 BOM, bilingual) | 🔲 Todo | High | Respects active filters |
| 8.2 | XLSX export (native, bold headers) | 🔲 Todo | High | |
| 8.3 | Save export to Vercel Blob + return download URL | 🔲 Todo | Medium | |
| 8.4 | Export history page in Settings | 🔲 Todo | Low | |

---

## Phase 9 — CRM & Outreach 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9.1 | Bitrix24 REST API client (`lib/bitrix24.ts`) | 🔲 Todo | High | Webhook-based |
| 9.2 | Push lead as Bitrix24 Contact + Deal | 🔲 Todo | High | |
| 9.3 | Sync deal stage bidirectionally | 🔲 Todo | High | Webhook inbound |
| 9.4 | Campaign manager view — group leads by type/tier | 🔲 Todo | Medium | |
| 9.5 | WhatsApp Business Cloud API client (`lib/whatsapp.ts`) | 🔲 Todo | High | |
| 9.6 | Send WhatsApp template message from lead sidebar | 🔲 Todo | High | |
| 9.7 | Inbound WhatsApp reply webhook → surface in app | 🔲 Todo | Medium | |
| 9.8 | Email outreach via Bitrix24 / SMTP | 🔲 Todo | Medium | |
| 9.9 | Bitrix24 calendar sync — schedule follow-ups | 🔲 Todo | Medium | |
| 9.10 | Bitrix24 app integrations (task importer, SPA importer, 2-way SMS) | 🔲 Todo | Low | Per linked apps in README |

---

## Phase 10 — Settings Interface 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 10.1 | Settings shell + nav | 🔲 Todo | High | |
| 10.2 | Profile settings (name, language, theme) | 🔲 Todo | High | |
| 10.3 | Scraper config (sources on/off, schedule, criteria defaults) | 🔲 Todo | High | |
| 10.4 | Integrations page (Bitrix24, WhatsApp, SMTP) | 🔲 Todo | High | Connect / disconnect |
| 10.5 | Notification preferences | 🔲 Todo | Low | |

---

## Phase 11 — PWA & Distribution 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11.1 | `manifest.json` (name, icons, theme color, standalone) | 🔲 Todo | High | |
| 11.2 | Service worker — cache app shell + last lead dataset | 🔲 Todo | Medium | |
| 11.3 | App icons — 192×192, 512×512 PNG | 🔲 Todo | Medium | EN + AR variants |
| 11.4 | Android APK via PWABuilder | 🔲 Todo | Medium | No Play Store |
| 11.5 | iOS Add to Home Screen — test + document for users | 🔲 Todo | Medium | No App Store |
| 11.6 | Offline fallback page | 🔲 Todo | Low | |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ Done | Complete and live |
| 🔲 Todo | Not started |
| 🔄 In progress | Currently being built |
| ⏸ Blocked | Waiting on dependency |

---

## Recommended Build Order

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
→ Phase 6 (AI pitch + chatbot) → Phase 7 (scraper)
→ Phase 5 (map) → Phase 8 (export) → Phase 9 (CRM)
→ Phase 10 (settings) → Phase 11 (PWA)
```

> ML (Phase 6.9–6.10) should only start after 500+ real leads are in the database.
