# UAE Real Estate Lead Scraper - System Architecture

This document serves as the unified technical authority on the system architecture for the UAE Real Estate Lead Scraper (LeadPulse). It details the core modules, security boundaries, asynchronous processing pipelines, and data models of our subscription-free HNWI prospecting platform.

---

## 🏗️ System Architecture Overview

LeadPulse is built on a decoupled, cost-efficient model. Rather than relying on expensive third-party scrapers (such as Apify, Apollo, or SerpAPI), the system utilizes an internal browser automation engine (Playwright Node.js) combined with a high-performance cognitive ingestion layer (Google Gemini API).

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend Dashboard                           │
│              Next.js 16.2 App Router (AR/EN)                   │
├────────────────────────────────┬────────────────────────────────┤
│   App Shell & Nav Navigation   │  Map Density & Geofence View   │
│   Smart Filtering Lead Table   │  CRM Push & Outreach Drawer    │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / Cookies / Headers
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Boundary Session & Security Guard                  │
│       proxy.ts (Handles Token Extraction & 401 JSON)            │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Secure Next.js Server Actions
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│            Cognitive API Orchestration Layer                     │
│               app/api/scrape/webhook/route.ts                  │
└────────────────────────────────┬────────────────────────────────┘
         ┌───────────────────────┼────────────────────────┐
         ▼                       ▼                        ▼
┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐
│  Browser Scraper │   │ Cognitive Parser   │   │ MySQL Database   │
│  Playwright/Node │   │ Google Gemini API  │   │ Railway Server   │
│  (Port 3002)     │   │ (lib/ai.ts Engine) │   │ (Prisma Client)  │
└──────────────────┘   └────────────────────┘   └──────────────────┘
```

---

## 🗂️ Architectural Layers

### 1. Security & Network Session Boundary (`proxy.ts`)
- **Purpose**: Unified route guard and request interceptor.
- **Session Extraction**: Extract session tokens from incoming cookies (`auth_token`) and fall back to HTTP headers (`Authorization: Bearer <token>`).
- **Enforcement Rules**: 
  - Restricts public access strictly to `/`, `/login`, `/api/auth/login`, and `/install` along with static assets.
  - Protects all other paths, including `/api/auth/me` and `/api/leads`.
  - Wrapped entirely in a `try/catch` block. On verification failure or runtime exceptions during an API call, it returns a clean JSON `{ error: "Unauthorized" }` with status `401` to prevent UI state crashes.

### 2. Browser Automation Layer (`scraper-service/`)
- **Technology**: Decoupled Express.js service running Playwright.
- **Port**: `3002` (Secure webhook payload transmission authenticated via `SCRAPER_SECRET`).
- **Sources Target**: alforsan.ae, adec.ae, dhabianequi.com, alhabtoorpoloclub.com, theartsclub.ae, rotary.ae, whatson.ae, adgm.com, difc.ae, ecouncil.ae (Official Gazette), arabianbusiness.com, propertymonitor.ae, abudhabichamber.ae.
- **Anti-Blocking**: Spoofs User-Agents, custom headers, and navigates organically to bypass detection.
- **Pipeline Webhook**: Dispatches crawled results asynchronously to the main Next.js `/api/scrape/webhook` receiver to prevent Vercel execution timeouts.

### 3. Cognitive Ingestion Layer (`lib/ai.ts`)
- **Technology**: Google Gemini Developer API.
- **Raw Text Cleaning**: The `cleanScrapedText` utility strips scripts, stylesheets, boilerplate footers, terms of use, and collapses spaces. It truncates text to 15,000 characters to optimize context windows and prevent attention drift.
- **Lead Extraction**: Gemini parses cleaned text using a single-roundtrip prompt, translating name, company, and role fields to both English and Arabic.
- **Behavioral Profiling**: Automatically generates a 2-3 sentence `persona` behavioral analysis paragraph.
- **JSON Parsing Resilience**: `safeParseJson` scrubs ASCII control characters (`\x00-\x1F`) and repairs trailing commas or smart curly quotes before executing JSON parsing.

### 4. Interactive AI Chat & SSE Abort Propagation (`app/api/ai/chat/route.ts`)
- **SSE Stream**: Streams chatbot responses chunk-by-chunk using `generativeLanguage` `streamGenerateContent` API, boosting the agent's felt speed.
- **Abort Signal Propagation**: Hooks `req.signal` (representing browser window closures or tab switches) and binds it directly as the `AbortSignal` for the Gemini `fetch` stream. When triggered, it terminates the active Gemini API generation immediately, successfully protecting quotas and billing.
- **Conversation Memory**: Chat messages are preserved inside the MySQL `ChatMessage` model. It commits the assistant text to database only after the stream completes successfully.

### 5. CRM Sync & Outreach Integrations (`lib/bitrix24.ts` & `lib/whatsapp.ts`)
- **Pre-flight Checks**: Before processing a bulk lead sync batch, a pre-flight `testConnection` is evaluated. If it fails, the API immediately halts and returns a clean `401` JSON error, avoiding partial pipeline syncs.
- **Transaction Breaks**: Sequentially wraps push operations in separate `try/catch` statements. If a 401 or `invalid_token` error is captured, it aborts the loop (`break`), leaving subsequent leads intact and logging the precise failure point.
- **Bilingual WhatsApp Layouts**: Arabic message drafts containing Latin variables (links, currency digital numerals, phone numbers) are formatted using Left-to-Right Marks (`\u200E`) and Right-to-Left Marks (`\u200F`). This guarantees punctuation stability and text layout alignment on mobile devices.

---

## 🗄️ Core Database Models

```prisma
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
  tier         Int       // 1 = Leadership, 2 = Management, 3 = Professional
  phone        String?
  email        String?
  location     String
  score        Int       // 0-100 qualified purchase likelihood
  signals      String    // Stringified signals array
  propertyPref String    // Stringified property preference object
  budgetMin    Float?
  budgetMax    Float?
  relocated    Boolean   @default(false)
  rentalFlag   Boolean   @default(false)
  status       String    @default("new")
  notes        String?
  persona      String?
  bitrix24Id   String?   // Linked CRM Contact ID
  agentId      String
  scrapeRunId  String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

---

## 🚀 Cost & Resource Optimization Analysis

| Dimension | Before (Paid APIs) | After (Playwright + Gemini) | Optimization Delta |
|-----------|--------------------|----------------------------|--------------------|
| **Crawl Subscriptions** | $250 - $1,300 / mo | $0 / mo (Self-Hosted) | **-100%** |
| **API Bandwidth** | Flat Rate Pricing | Pay-as-you-go (Text only) | **-90%** |
| **Ingestion Quota** | Saturated Context Windows | Clean Text DOM (15k Limit) | **-80% Token Savings** |
| **Generation Terminations** | Uncontrolled leaks | SSE Aborts on disconnect | **-100% Leaked Quota** |

---

## 🛠️ Operations & Maintenance

### 1. Local Health Verification
Validate all active environment variables and connectivity pipelines:
```bash
npx tsx scratch/validate-secrets.ts
```

### 2. Full Type checks & Compilation Verification
Verify type-safety and syntax completeness:
```bash
npx tsc --noEmit
```

### 3. Database Introspection & Schema Alignment
Synchronize local Prisma client with production MySQL server:
```bash
npx prisma db pull
npx prisma generate
```
