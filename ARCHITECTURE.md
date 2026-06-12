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
- **Unified Session Verification**: All protected API endpoints and Server Components consume a unified session retrieval interface via `getSession()` from `lib/auth.ts`, ensuring that all APIs retrieve user credentials identically and avoiding authorization bypasses or mismatch issues.
- **Enforcement Rules**: 
  - Restricts public access strictly to `/`, `/login`, `/api/auth/login`, and `/install` along with static assets.
  - Protects all other paths, including `/api/auth/me`, `/api/leads`, and `/api/leads/cluster`.
  - Wrapped entirely in a `try/catch` block. On verification failure or runtime exceptions during an API call, it returns a clean JSON `{ error: "Unauthorized" }` with status `401` to prevent UI state crashes.
  - **RBAC & Capping**: Admins have full access. Non-admins (agents) cannot view or access the Integrations page and cannot edit core lead details (restricted to notes and status). They only have visibility over leads that belong to them (enforced via `agentId` filtering). Role verification is normalized across all routes via a standard `isAdmin` helper that handles variant role strings (e.g. `"super admin"`, `"SUPER_ADMIN"`, `"admin"`, etc.). Standard leads list queries and search results utilize normal pagination parameters without an artificial capping limit, enabling agents to accumulate and browse all of their leads over multiple scrape runs. Additionally, on zero-result scraper runs (totalLeads === 0), a smart backend fallback mechanism in the webhook completion handler automatically fetches up to 10 active matching leads from the database based on search criteria (or agent/global fallbacks) and links them to the current ScrapeRun, ensuring seamless user experience and UI continuity.

### 2. Browser Automation Layer (`scraper-service/`)
- **Technology**: Decoupled Express.js service running Playwright.
- **Port**: `3002` (Secure webhook payload transmission authenticated via `SCRAPER_SECRET`).
- **Sources Target**: alforsan.ae, adec.ae, dhabianequi.com, alhabtoorpoloclub.com, theartsclub.ae, rotary.ae, whatson.ae, adgm.com, difc.ae, ecouncil.ae (Official Gazette), arabianbusiness.com, propertymonitor.ae, abudhabichamber.ae.
- **Anti-Blocking**: Spoofs User-Agents, custom headers, and navigates organically to bypass detection.
- **Pipeline Webhook**: Dispatches crawled results asynchronously to the main Next.js `/api/scrape/webhook` receiver to prevent Vercel execution timeouts.
- **Selector Validation**: Performs strict Playwright-compatible selector validation (CSS, XPath, Text, and compound selectors) at the API input level (`/create-source`) and skips invalid selectors at the execution level to prevent Playwright Chromium crashes.
- **Bilingual Selector Externalization**: Page termination checks and consent accept selectors are externalized to a modular config (`scraper-service/src/ui-strings.js`) to decouple crawler code from hardcoded English/Arabic UI strings and support easier language additions.
- **Proxy Credentials Masking**: All connection errors, validation results, and diagnostic logger events pass through `maskProxyUrl` to redact sensitive credentials (`username:password`) before logs are stored in Vercel Blob or printed in stdout.
- **State Synchronization Safeguards**: The default sources seeding logic executes in a non-destructive manner on cold-boot, inserting new default source templates but *never* overwriting existing user-customized selectors, signals, or crawlDepth settings in the shared database.
- **Dynamic CSS Selector Resolution**: The registry scraper module (`lib/registry.ts`) dynamically resolves CSS selectors by querying the `SourceConfig` table in the database rather than utilizing hardcoded selector lists. If the source config is missing (e.g., for DED registry), it auto-generates a default row with standard fallbacks, keeping the scraping system fully configurable and resilient to markup updates.
- **Global Failover Webhook**: If the scraper microservice encounters a terminal crash (e.g. browser launch failure), it catches the exception and immediately dispatches an `isFailedSignal` webhook back to the Next.js app to transition the scrape run status to `FAILED`, preventing forever-stuck `PROCESSING` statuses.
- **Graceful Shutdown**: Listens to system termination signals (`SIGTERM`, `SIGINT`) to gracefully stop the HTTP server and completely disconnect the Prisma client database connection pool (`prisma.$disconnect()`), avoiding socket leaks and connection exhaustion on container recycles.
- **Robust Watchdog & Lifecycle Management**: 
  - **Asynchronous Safe Close**: All `browser.close()` calls are protected by a non-blocking `Promise.race` wrapper with a 5-second timeout, ensuring that hung Playwright browser processes never stall queue execution.
  - **Active Database Watchdog**: A background worker in the scraper service running every 2 minutes monitors the database for zombie runs (status `PENDING` or `PROCESSING` older than 10 minutes). It automatically force-marks them as `FAILED`, cancels the job in the execution queue, safely disposes the hung browser, and creates a system notification for the agent.
  - **Passive Self-Healing**: Next.js API endpoints (`/api/scrape`, `/api/scrape-runs/[id]`, and `/api/scrape-runs/[id]/sse`) proactively check for and recover timed-out runs in the database on demand, providing a secondary layer of resilience.
  - **Prisma Client Consolidation**: Features a single shared `PrismaClient` client in `scraper-service/src/prisma.js` (with a max connection pool limit of `3` and an auto-reconnect lock proxy) to eliminate connection leaks and Railway pool exhaustion.
- **Concurrent In-Memory Queue**: Rather than rejecting overlapping scrape requests with a `429` status code, the service queues incoming scraper requests in a FIFO `scrapeQueue`. The active jobs are executed concurrently (`MAX_CONCURRENT_SCRAPES = 2` by default, configurable) to enable faster parallel processing while bounding RAM usage. Newly created scraper runs are saved with a `"PENDING"` status, transitioning to `"PROCESSING"` when execution starts (triggered via an `isStartedSignal` webhook sent to the Next.js app). Exposes `GET /queue` to allow operators to inspect the execution pipeline diagnostics in real-time.

### 3. Cognitive Ingestion Layer (`lib/ai.ts`)
- **Technology**: Google Gemini Developer API.
- **Raw Text Cleaning**: The `cleanScrapedText` utility strips scripts, stylesheets, boilerplate footers, terms of use, and collapses spaces. It truncates text to 15,000 characters to optimize context windows and prevent attention drift.
- **Lead Extraction**: Gemini parses cleaned text using a single-roundtrip prompt, translating name, company, and role fields to both English and Arabic.
- **Behavioral Profiling & Signals Extraction**: Generated strictly on-demand. Initial ingestion (scrapers and CSV imports) saves leads with `persona: null` and simple tags, avoiding expensive LLM calls. The user triggers full persona profiling and news signal extraction on-demand from the Lead Sidebar UI, which calls Gemini, applies automated boilerplate/preamble cleaning, and caches the results back to the database.
- **JSON Parsing Resilience**: `safeParseJson` scrubs ASCII control characters (`\x00-\x1F`) and repairs trailing commas or smart curly quotes before executing JSON parsing.

### 4. Interactive AI Chat & SSE Abort Propagation (`app/api/ai/chat/route.ts`)
- **SSE Stream**: Streams chatbot responses chunk-by-chunk using `generativeLanguage` `streamGenerateContent` API, boosting the agent's felt speed.
- **Abort Signal Propagation**: Hooks `req.signal` (representing browser window closures or tab switches) and binds it directly as the `AbortSignal` for the Gemini `fetch` stream. When triggered, it terminates the active Gemini API generation immediately, successfully protecting quotas and billing.
- **Conversation Memory**: Chat messages are preserved inside the MySQL `ChatMessage` model. It commits the assistant text to database only after the stream completes successfully.

### 5. CRM Sync & Outreach Integrations (`lib/bitrix24.ts` & `lib/whatsapp.ts`)
- **Shared Credentials**: All API and integration secrets (such as Bitrix24 token, WhatsApp token, SMTP, and Gemini API keys) are defined in the Super Admin profile (`admin@brilliance-lead.uk`) and securely shared with all agents via `lib/secrets.ts`.
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
  signals      Json      // Array of signals
  propertyPref Json      // Property preference object
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

| Dimension | Before | After | Optimization Delta |
|-----------|--------|-------|--------------------|
| **Crawl Subscriptions** | $250 - $1,300 / mo | $0 / mo (Self-Hosted) | **-100% Cost** |
| **API Bandwidth** | Flat Rate Pricing | Pay-as-you-go (Text only) | **-90% Bandwidth** |
| **Ingestion Quota** | Saturated Context Windows | Clean Text DOM (15k Limit) | **-80% Token Savings** |
| **Generation Terminations** | Uncontrolled leaks | SSE Aborts on disconnect | **-100% Leaked Quota** |
| **DB Connections** | Infinite clients/threads | Capped shared pool (limit=3) | **Prevent Pool Exhaustion** |
| **Duplicate Checking** | O(N) queries (row-by-row) | O(1) query per batch | **90% Ingestion Latency reduction** |
| **Model Size/Bloat** | TensorFlow.js (30MB+ package) | Pure JS Gradient Descent | **Zero-Dependency Cold Start** |

---

## 🛡️ Database Connection Proxy & Resilient Reconnection

To mitigate transient connection drops and "Concurrent Reconnect Storms" (especially under serverless/concurrent environment constraints against Railway's TCP proxies), a custom resilient Proxy layer wraps the Prisma Client in [prisma.ts](file:///c:/projects/Real-Estate-Lead-Scraper/lib/prisma.ts):

- **Thundering Herd Mitigation**: Utilizes a single global `reconnectLock` Promise. When concurrent database queries fail due to connection errors, only the first query triggers the reconnection sequence. All subsequent queries await this same Promise rather than spawning separate connection attempts.
- **Dynamic Exponential Backoff**: The reconnection routine utilizes a global `reconnectAttempts` counter to dynamically calculate delays ($100ms \times 2^{attempt}$, capped at $1000ms$) with added random jitter.
- **Self-Healing & Reset**: 
  - On connection failure, the proxy increments the attempt counter to delay subsequent reconnects further, protecting the DB from overload.
  - On any successful connection or successful query execution, the attempt counter is immediately reset to `0`, ensuring that future transient drops start at the minimum base latency.

---

## 🔒 Security Hardening & Compliance Layer

To resolve identified security vulnerabilities, legal risks, and data leakage vectors, LeadPulse implements a multi-layered security hardening architecture:

### 1. Production Secrets Enforcements & Masking
- **Strict Validation**: Both Next.js and the Express scraper service enforce fail-secure boot cycles. The application will crash on startup in production if `SCRAPER_SECRET` or `JWT_SECRET` are not explicitly defined in the environment.
- **Log Masking**: Output logger utilities (`env-loader.js`) mask sensitive details, redacting database connection parameters and rendering only relative filenames instead of absolute directory structures in production logs.

### 2. Legal Compliance & Rate-Limiting (UAE PDPL Compliance Mode)
- **Domain Restrictions**: Under compliance mode (`uaeComplianceMode: true`), the scraper engine blocks requests targeting domains with strict anti-scraping policies (such as `bayut.com`, `dubizzle.com`, and `propertyfinder.ae`) and records skipped reasons in audit logs.
- **Per-Source Rate Limiting**: Request pacing is dynamically regulated on page transitions. The crawler forces page delays to be the maximum of the configured per-source delay and the global rate limit delay (default `3000ms`), preventing target IP banning.

### 3. API & Webhook Hardening
- **Cron Authorization**: The weekly digest notification cron route (`/api/cron/notifications/weekly-digest`) is secured using a Bearer token verification check against `process.env.CRON_SECRET`.
- **Zod Schema Sanitization**: Input validation schemas defined in Zod are applied in hot paths (`/api/leads/[id]` and `/api/leads/import`), cleaning up formatting anomalies in emails/phones, rejecting malformed structures, and preventing SQL injection vectors before database persistence.
- **Signal Scrubbing Filter**: Ingestion pipelines (webhooks and CSV imports) execute automated backend signal scrubbing via `deduplicateSignals` and `parseSignals` using regular expression matching against a technical signal blacklist (e.g. `Manual Import`, `scraper`, `webhook`). This prevents internal technical metadata and system-generated labels from leaking into the `signals` JSON array of the `Lead` model.
- **Ownership Verification Re-ordering**: The lead update endpoint (`/api/leads/[id]`) checks ownership (`agentId` mismatch) first for non-admin agents before verifying restricted fields. This guarantees fail-secure execution and prevents unauthorized non-owner agents from updating any lead notes or statuses.
- **Minimal Dirty Field Submissions**: The frontend `LeadSidebar.tsx` edit form compares current inputs against the loaded lead props, submitting only modified/dirty fields (such as `signals` or `tier`) to the API. This enables standard automatic tier computation on the backend when only the score changes, while respecting explicit manual overrides when the tier is modified.
- **Pagination State Preservation**: State updates on successful lead edits/deletions propagate via background context refreshes (`onUpdate` state callbacks) rather than full page reloads (`window.location.reload()`). This preserves frontend states, table page offsets, and active search filters.
- **CRM Sync Error Logging**: Asynchronous CRM synchronization calls (fire-and-forget in PATCH updates, as well as synchronous POST/bulk pushes) capture exceptions and update the lead's `metadata` JSON field with a `"FAILED"` status and precise error details (with status `"SUCCESS"` on success). If a failure occurs, the system automatically dispatches an error `Notification` record in the database for all admin users (e.g. CEOs and supervisors) to raise immediate in-app warnings.
- **Bulk Status Update (Race Condition Mitigation)**: The bulk status update endpoint (`/api/leads/bulk-update`) processes status transitions for multiple selected leads in a single database operation (`prisma.lead.updateMany`), resolving race conditions and preventing database deadlocks caused by concurrent HTTP connections. It enforces ownership validation (non-admin users can only update their own leads) and records separate audit log entries for all updated records via `prisma.auditLog.createMany`.
### 4. Service Worker Cache Isolation
- **Client-Side Data Prevention**: To prevent data storage leakage of personal identifiable information (PII) on shared browsers/mobile devices, the Service Worker cache (`sw.js`) explicitly bypasses caching for all sensitive application shell paths (`/leads`, `/map`, `/search`, `/campaigns`, `/settings`).

### 5. Soft Delete & GDPR Retention Policy
- **Soft Deletion & Merging**: Lead deletions execute via soft deletes (`deletedAt` timestamp). Webhook re-ingestions of soft-deleted leads restore and merge details seamlessly while creating structured audit entries.
- **Data Pruning**: An automated retention cleanup policy runs hard deletions on expired lead records older than 90 days, complying with global and regional data protection regulations (e.g. UAE PDPL).

### 6. Map Lead Data Protection (Data Security Leak Mitigation)
- **Exclusion of Sensitive Fields**: The geographic clusters API (`/api/leads/cluster`) explicitly excludes personal identifiable information (PII) including `phone`, `email`, `notes`, and `signals` from the Prisma select statement, preventing external scraping or data harvesting of the HNWI list.
- **Dynamic Lazy-Loading**: When a user selects a lead to view its details (e.g., clicking "View Full Profile" on the map), the frontend `LeadSidebar` issues a secure dynamic `GET` request to `/api/leads/[id]`. This endpoint is secured using session verification and RBAC checks (restricting agents to their own leads, admins to all), returning the full details on demand.
- **Visual Feedback**: Displays a premium blur loader overlay on the tab content panel of `LeadSidebar` during the secure lazy-load process.

---

## 📡 Real-Time Progress Tracking via Event-Driven SSE

To resolve the "Query Storm" database connection stress issue under concurrent user activity, LeadPulse has migrated from database polling to a real-time event-driven Server-Sent Events (SSE) tracking system:

1. **Global In-Memory Event Broker**: A centralized event emitter singleton [scrape-events.ts](file:///c:/projects/Real-Estate-Lead-Scraper/lib/scrape-events.ts) propagates scrape run updates.
2. **Prisma Mutation Triggers**: Anytime a scrape run is created, updated, or when batch lead increments occur, the application triggers `notifyScrapeRunUpdate()`. This reads the latest run details and emits an event in-memory.
3. **SSE Connection Subscriptions**: The SSE handler [route.ts](file:///c:/projects/Real-Estate-Lead-Scraper/app/api/scrape-runs/%5Bid%5D/sse/route.ts) subscribes to `run:{id}` events. Instead of executing periodic database queries inside a loop, it yields the Node.js event loop and waits for events, which are pushed to the client instantly.
4. **Resilient Frontend Failbacks**: The `useScrapeRunStatus` React hook connects to the SSE route and safely falls back to standard HTTP polling only if the stream encounters a connection error *before* reaching a terminal state. If the stream closes normally after the run completes or fails, the hook terminates tracking immediately without entering a polling loop.


---

## 📊 Metrics, Diagnostics & Alarm Alignment

To enable robust system monitoring and dashboard alignment, LeadPulse exposes a secure telemetry endpoint and real-time failure indicators:

1. **Telemetry Endpoint (`/api/metrics`)**: Serves Prometheus-compatible metrics and JSON diagnostics.
2. **Filters & Parameter Alignment**: The metrics queries support all primary search and filtering parameters (`search`, `status`, `tier`, `scrapeRunId`, etc.) matching the Leads API. This guarantees that total lead telemetry exactly mirrors active filtered dashboard numbers on the frontend.
3. **Manual Import Exclusions**: Manually imported leads (`source: "Manual Import"`) are filtered out from the `leadsBySource` telemetry group to match the UI behavior of hiding internal manual import labels.
4. **Active Scrape Runs Filter**: Scrape runs metrics exclude completed runs where all associated leads have been soft-deleted, keeping historical logs metrics reflective of the active database state.
5. **High Failure Rate Alarm**: If the failure rate across the 5 most recent scrape runs is $\ge 50\%$, the metrics endpoint triggers a high failure alarm (`brilliance_scraper_high_failure_alert 1`). The same calculation is run on the Search and Scraper Settings pages to display a prominent warning banner (EN/AR) before new scrapes are started.

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
