Phase 0 — Project Setup 🔲
#TaskStatusPriorityNotes0.1Init Next.js 14 + TypeScript repo🔲 TodoHighcreate-next-app --typescript0.2Configure Tailwind CSS + design token CSS variables🔲 TodoHighFrom design-system.md0.3Set up Railway MySQL + Prisma schema🔲 TodoHighSee schema in README0.4Connect Vercel project + env vars🔲 TodoHigh0.5Set up Vercel Blob🔲 TodoHighFor exports + snapshots0.6Set up i18n (next-i18next) EN + AR🔲 TodoHighRTL on <html dir>0.7Configure Arabic font (Cairo/Tajawal) + Inter for EN🔲 TodoHighGoogle Fonts or self-hosted0.8PWA manifest + service worker skeleton🔲 TodoMedium0.9Linting, Prettier, path aliases, strict TS config🔲 TodoMedium0.10Set up Railway scraper service (Node.js + Playwright)🔲 TodoHighSeparate repo or monorepo

Phase 1 — Auth & User Management 🔲
#TaskStatusPriorityNotes1.1Login page UI (email + password)🔲 TodoHighEN/AR, responsive1.2JWT auth (sign, verify, refresh)🔲 TodoHighStored in httpOnly cookie1.3Password hashing (bcrypt)🔲 TodoHigh1.4Protected route middleware🔲 TodoHighmiddleware.ts1.5User roles (admin, agent)🔲 TodoMedium1.6Seed first admin user via script🔲 TodoHigh

Phase 2 — Design System & UI Shell 🔲
#TaskStatusPriorityNotes2.1Build token CSS file (styles/tokens.css)🔲 TodoHighAll color + spacing tokens2.2Build Button, Input, Select, Badge, Modal components🔲 TodoHigh2.3Build AppShell + NavSidebar (EN left / AR right)🔲 TodoHigh2.4Build TopBar with EN/AR toggle + dark mode switch🔲 TodoHigh2.5Responsive breakpoints (sm / md / lg / xl)🔲 TodoHigh2.6Dark mode token swap via data-theme="dark"🔲 TodoMedium2.7RTL logical CSS audit — no margin-left, padding-right hardcoded🔲 TodoHigh2.8Directional icon mirroring (chevrons, arrows) in RTL🔲 TodoMediumscaleX(-1)

Phase 3 — Lead Qualification Search 🔲
#TaskStatusPriorityNotes3.1QualificationForm component🔲 TodoHighBefore each scrape3.2Property type multi-select (apartment/villa/townhouse/penthouse/commercial)🔲 TodoHigh3.3Budget range slider + AED manual input🔲 TodoHighfrom / to3.4Recently relocated toggle🔲 TodoMedium3.5Exclude rental behavior toggle🔲 TodoHigh3.6Target emirate(s) multi-select🔲 TodoMedium3.7Signal filter + tier minimum🔲 TodoMedium3.8Save search criteria to MySQL (Search table)🔲 TodoMedium3.9Load previous search as preset🔲 TodoLow

Phase 4 — Lead Table & UI 🔲
#TaskStatusPriorityNotes4.1LeadTable component — all columns🔲 TodoHighScore, tier, source, signals, contact4.2ScoreBadge — color-coded circle🔲 TodoHigh4.3TierBadge — T1/T2/T3 chip🔲 TodoHigh4.4SignalChip — per signal color🔲 TodoHigh4.5Filters: tier, source, signal, location, budget, property type🔲 TodoHigh4.6Free-text search (name + company)🔲 TodoHigh4.7Sort by score / name / date added🔲 TodoMedium4.8LeadSidebar — RTL-aware detail panel🔲 TodoHigh4.9Copy phone/email on click🔲 TodoMedium4.10Lead status dropdown (New/Contacted/Qualified/Won/Lost)🔲 TodoHighSaved to MySQL4.11Notes field per lead🔲 TodoMediumInline in sidebar4.12Optional save selected leads before committing to DB🔲 TodoHighAgent manually flags

Phase 5 — UAE Map View 🔲
#TaskStatusPriorityNotes5.1EmirateMap SVG component🔲 TodoMediumAll 7 emirates + DIFC + ADGM zones5.2Lead density color coding per emirate🔲 TodoMediumOpacity scale5.3Click emirate → filter lead table🔲 TodoMedium5.4Emirate label EN/AR toggle🔲 TodoMedium5.5Legend with lead counts🔲 TodoLow

Phase 6 — AI Features 🔲
#TaskStatusPriorityNotes6.1AI pitch API route (/api/ai/pitch)🔲 TodoHighClaude API, EN/AR prompt6.2Pitch renders in sidebar inline🔲 TodoHigh6.3Pitch language follows active UI language🔲 TodoHigh6.4AI signal extraction — parse scraped text → assign signals🔲 TodoHighClaude API batch6.5Chatbot component (AgentChatbot)🔲 TodoHighFloating, persistent6.6Chatbot memory stored in MySQL (ChatMessage table)🔲 TodoHighFull conversation history per agent6.7Chatbot API route (/api/ai/chat)🔲 TodoHighPasses history each call6.8Chatbot EN/AR — responds in active language🔲 TodoMedium6.9ML model: TensorFlow.js — train on lead outcomes🔲 TodoLowStart after 500+ leads in DB6.10ML: adjust base score weights based on agent feedback🔲 TodoLowWon/Lost signals feed model

Phase 7 — Scraper Backend 🔲
#TaskStatusPriorityNotes7.1Scraper service scaffold (Railway, Node.js + Playwright)🔲 TodoHigh7.2Proxy rotation + rate limiting🔲 TodoHighRequired for portals7.3Scrape Bayut🔲 TodoHighCheck ToS7.4Scrape Dubizzle🔲 TodoHighCheck ToS7.5Scrape Zawya Invest🔲 TodoHigh7.6Scrape ADGM / DIFC public registry🔲 TodoHighPublic data7.7Scrape DED commercial license registry🔲 TodoMedium7.8Scrape Forbes ME wealth lists🔲 TodoMedium7.9Scrape Bloomberg MENA executive mentions🔲 TodoMedium7.10Elite lifestyle / concierge source list (manual curation)🔲 TodoLow7.11Lead deduplication (phone + email + name match)🔲 TodoHigh7.12Incremental scrape — append only, never overwrite🔲 TodoHigh7.13Scrape run log to MySQL (ScrapeRun table)🔲 TodoHigh7.14Vercel Cron trigger at 02:00 GST daily🔲 TodoHigh/api/cron/scrape7.15Criteria-aware scraper (property type, budget, location filter)🔲 TodoHighPass Search criteria to scraper7.16Rental behavior detection + exclusion logic🔲 TodoMedium7.17Recently relocated detection (registry date, LinkedIn signal)🔲 TodoMedium

Phase 8 — Export 🔲
#TaskStatusPriorityNotes8.1CSV export (UTF-8 BOM, bilingual)🔲 TodoHighRespects active filters8.2XLSX export (native, bold headers)🔲 TodoHigh8.3Save export to Vercel Blob + return download URL🔲 TodoMedium8.4Export history page in Settings🔲 TodoLow

Phase 9 — CRM & Outreach 🔲

Bitrix24 integration is split into 3 phases. Never skip to Phase B or C until the previous phase is confirmed stable in production.

Phase 9A — Contacts Push (Launch scope) 🔲
#TaskStatusPriorityNotes9A.1lib/bitrix24.ts — pushContact() using crm.contact.add🔲 TodoHighSingle endpoint, no webhooks9A.2"Push to Bitrix24" button in lead sidebar🔲 TodoHighOne-click per lead9A.3Bulk push — selected leads from table🔲 TodoHighCheckbox select + push action9A.4Push confirmation + error handling in UI🔲 TodoHighShow success/fail per lead9A.5Store bitrix24ContactId on Lead record in MySQL🔲 TodoMediumPrevents duplicate pushes9A.6Settings page — Bitrix24 domain + token + test connection🔲 TodoHighValidate before saving9A.7WhatsApp Business API client (lib/whatsapp.ts)🔲 TodoHighSend template messages9A.8Send WhatsApp message from lead sidebar🔲 TodoHighUses lead phone number9A.9Email outreach — compose + send via SMTP🔲 TodoMediumResend or nodemailer
Phase 9B — Deals Push (Post-launch, after 9A stable) 🔲
#TaskStatusPriorityNotes9B.1pushDeal() using crm.deal.add — linked to contact🔲 TodoMediumAdd after 9A confirmed working9B.2Map property type + budget + emirate → Bitrix24 deal fields🔲 TodoMedium9B.3Settings: push mode toggle (Contacts only / Contacts + Deals)🔲 TodoMediumDefault: Contacts only9B.4Campaign manager view — group leads by property type or tier🔲 TodoMedium9B.5Bitrix24 calendar sync — schedule follow-ups🔲 TodoLow
Phase 9C — Bidirectional Sync (Optional, only if agents request it) 🔲
#TaskStatusPriorityNotes9C.1Inbound Bitrix24 webhook → update lead status in MySQL🔲 TodoLowOnly if agents manage deals in Bitrix249C.2WhatsApp inbound reply webhook → surface in app🔲 TodoLow9C.3Bitrix24 app integrations (task importer, SPA importer, 2-way SMS)🔲 TodoLowOnly if explicitly requested

Phase 10 — Settings Interface 🔲
#TaskStatusPriorityNotes10.1Settings shell + nav🔲 TodoHigh10.2Profile settings (name, language, theme)🔲 TodoHigh10.3Scraper config (sources on/off, schedule, criteria defaults)🔲 TodoHigh10.4Integrations page (Bitrix24, WhatsApp, SMTP)🔲 TodoHighConnect / disconnect10.5Notification preferences🔲 TodoLow

Phase 11 — PWA & Distribution 🔲
#TaskStatusPriorityNotes11.1manifest.json (name, icons, theme color, standalone)🔲 TodoHigh11.2Service worker — cache app shell + last lead dataset🔲 TodoMedium11.3App icons — 192×192, 512×512 PNG🔲 TodoMediumEN + AR variants11.4Android APK via PWABuilder🔲 TodoMediumNo Play Store11.5iOS Add to Home Screen — test + document for users🔲 TodoMediumNo App Store11.6Offline fallback page🔲 TodoLow

Legend
SymbolMeaning✅ DoneComplete and live🔲 TodoNot started🔄 In progressCurrently being built⏸ BlockedWaiting on dependency

Recommended Build Order
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
→ Phase 6 (AI pitch + chatbot) → Phase 7 (scraper)
→ Phase 5 (map) → Phase 8 (export) → Phase 9 (CRM)
→ Phase 10 (settings) → Phase 11 (PWA)

ML (Phase 6.9–6.10) should only start after 500+ real leads are in the database.
