# Implementation Tracker — real estate lead scraper
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

> Bitrix24 integration is split into 3 phases. Never skip to Phase B or C until the previous phase is confirmed stable in production.

### Phase 9A — Contacts Push (Launch scope) 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9A.1 | `lib/bitrix24.ts` — `pushContact()` using `crm.contact.add` | 🔲 Todo | High | Single endpoint, no webhooks |
| 9A.2 | "Push to Bitrix24" button in lead sidebar | 🔲 Todo | High | One-click per lead |
| 9A.3 | Bulk push — selected leads from table | 🔲 Todo | High | Checkbox select + push action |
| 9A.4 | Push confirmation + error handling in UI | 🔲 Todo | High | Show success/fail per lead |
| 9A.5 | Store `bitrix24ContactId` on Lead record in MySQL | 🔲 Todo | Medium | Prevents duplicate pushes |
| 9A.6 | Settings page — Bitrix24 domain + token + test connection | 🔲 Todo | High | Validate before saving |
| 9A.7 | WhatsApp Business API client (`lib/whatsapp.ts`) | 🔲 Todo | High | Send template messages |
| 9A.8 | Send WhatsApp message from lead sidebar | 🔲 Todo | High | Uses lead phone number |
| 9A.9 | Email outreach — compose + send via SMTP | 🔲 Todo | Medium | Resend or nodemailer |

### Phase 9B — Deals Push (Post-launch, after 9A stable) 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 9B.1 | `pushDeal()` using `crm.deal.add` — linked to contact | 🔲 Todo | Medium | Add after 9A confirmed working |
| 9B.2 | Map property type + budget + emirate → Bitrix24 deal fields | 🔲 Todo | Medium | |
| 9B.3 | Settings: push mode toggle (Contacts only / Contacts + Deals) | 🔲 Todo | Medium | Default: Contacts only |
| 9B.4 | Campaign manager view — group leads by property type or tier | 🔲 Todo | Medium | |
| 9B.5 | Bitrix24 calendar sync — schedule follow-ups | 🔲 Todo | Low | |

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
| 10.1 | Settings shell + nav | 🔲 Todo | High | |
| 10.2 | Profile settings (name, language, theme) | 🔲 Todo | High | |
| 10.3 | Scraper config (sources on/off, schedule, criteria defaults) | 🔲 Todo | High | |
| 10.4 | Integrations page (Bitrix24, WhatsApp, SMTP) | 🔲 Todo | High | Connect / disconnect |
| 10.5 | Notification preferences | 🔲 Todo | Low | |

---

## Phase 11 — PWA & Distribution 🔲

### 11A — PWA Foundation 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11A.1 | `manifest.json` — name, short_name, theme_color `#185FA5`, background_color `#F7F8FA`, display `standalone` | 🔲 Todo | High | |
| 11A.2 | App icons — 192×192 and 512×512 PNG, maskable variant for Android | 🔲 Todo | High | EN + AR wordmark variants |
| 11A.3 | Service worker — cache app shell + last lead dataset offline | 🔲 Todo | Medium | Use Workbox or hand-rolled |
| 11A.4 | Offline fallback page — shows last cached leads, blocks new scrape | 🔲 Todo | Medium | |
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
| 11C.3 | Add `apple-touch-icon` meta tags in `app/layout.tsx` | 🔲 Todo | High | iOS ignores manifest icons — needs own tag |
| 11C.4 | Add `apple-mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style` meta tags | 🔲 Todo | Medium | Controls status bar appearance |
| 11C.5 | Test push notifications on iOS (requires Home Screen install) | 🔲 Todo | Low | iOS 16.4+ only, opt-in rates low |

### 11D — Agent Onboarding Install Page 🔲

| # | Task | Status | Priority | Notes |
|---|------|--------|----------|-------|
| 11D.1 | Create `/install` route in `app/(app)/install/page.tsx` | 🔲 Todo | High | Public route — no auth required |
| 11D.2 | Device detection — auto-detect Android / iOS / Desktop on load | 🔲 Todo | High | Use `navigator.userAgent` — no library needed |
| 11D.3 | Android panel — "Download App" button linking to Vercel Blob APK URL | 🔲 Todo | High | One tap install |
| 11D.4 | iOS panel — 4-step visual guide: Open in Safari → Tap Share → Add to Home Screen → Open LeadPulse | 🔲 Todo | High | Screenshots in AR + EN |
| 11D.5 | Desktop panel — "Install from browser" button triggering PWA install prompt | 🔲 Todo | Medium | Uses intercepted `beforeinstallprompt` |
| 11D.6 | `/install` page in EN + AR with full RTL layout | 🔲 Todo | High | First page many agents will see |
| 11D.7 | QR code on `/install` page linking to itself — for sharing in WhatsApp/email | 🔲 Todo | Medium | Generate via `qrcode` npm package |
| 11D.8 | Add `/install` link to agent onboarding email template | 🔲 Todo | Medium | Sent when admin creates a new agent account |

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
