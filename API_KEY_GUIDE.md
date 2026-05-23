# Brilliance Lead Scraper — API Key Management Guide

This document clarifies the purpose, usage, and optimization of each API key used in the Brilliance platform to ensure maximum performance and zero conflicts.

## 1. Core Intelligence: Google Gemini
- **Key**: `GOOGLE_AI_API_KEY`
- **Purpose**: The "Brain" of the platform.
- **Usage**:
    - **Signal Extraction**: Analyzing news snippets and scraped text to identify "Buy" signals.
    - **Lead Enrichment**: Mapping raw data to the Lead schema.
    - **AI Pitch Generation**: Creating personalized sales pitches in English and Arabic.
    - **Agent Chatbot**: Powering the persistent AI assistant.
- **Optimization**: We use `gemini-1.0` for the best balance of speed and intelligence.

## 2. Internal Abu Dhabi Scraper Service
- **URLs**: `SCRAPER_SERVICE_URL`
- **Secret**: `SCRAPER_SECRET`
- **Purpose**: Central engine for scraping premium Abu Dhabi HNWI sources using a custom Playwright microservice.
- **Usage**: Targets local elite ecosystem sites, the ADGM/DIFC public registers, private club directories, and boutique investor portals.
- **Optimization**: Designed for deep crawl, pagination handling, and DOM cleaning without third-party subscription costs.

## 3. Residential Proxy Service
- **URL**: `PROXY_SERVICE_URL`
- **Key**: `PROXY_API_KEY`
- **Purpose**: Rotate residential proxies to bypass bot protection and Cloudflare-style defenses.
- **Usage**: Optional but recommended for high-reliability scraping of Abu Dhabi business sites and restricted index pages.
- **Optimization**: Use only when necessary to reduce request costs and preserve scraper stability.

## 5. CRM Integration: Bitrix24
- **Key**: `BITRIX24_TOKEN` (Inbound Webhook)
- **Purpose**: Pipeline synchronization.
- **Usage**: Pushing qualified leads and linked deals into your Bitrix24 CRM pipeline.
- **Optimization**: Supports "Contacts only" or "Contacts + Deals" modes to match your CRM workflow.

## 6. Outreach: WhatsApp Business
- **Key**: `WHATSAPP_TOKEN`
- **Purpose**: Automated client engagement.
- **Usage**: Sending instant WhatsApp messages to new leads directly from the dashboard.
- **Optimization**: Uses official Meta templates to ensure high delivery rates and brand compliance.

---

### Avoiding Conflicts
- **Source Tagging**: Every lead is tagged with its `source` (e.g., "Apollo", "PropertyFinder", "News"). This prevents duplicate entries from different sources.
- **Deduplication**: The system automatically checks for existing names/companies/emails before saving to prevent clutter.
- **Sequential Processing**: Scrapers run sequentially (Apify → SerpAPI → Apollo) to avoid hitting rate limits or CPU spikes.
