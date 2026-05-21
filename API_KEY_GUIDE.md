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

## 2. Real Estate Scraper: Apify
- **Key**: `APIFY_API_TOKEN`
- **Actor**: `tamer_almstkshf/Real-Estate-Lead-Scraper`
- **Purpose**: Specialized property portal scraping.
- **Usage**: Directly targets PropertyFinder, Bayut, and Dubizzle to find active property inquiries and market trends.
- **Optimization**: Only triggered via Vercel Cron or manual "Run Scraper" action to minimize credit usage.

## 3. Global Prospecting: Apollo.io
- **Key**: `APOLLO_API_KEY` (Requires Master Key)
- **Purpose**: B2B executive and investor discovery.
- **Usage**: Finds "Net New" high-net-worth individuals in the UAE (CEOs, Founders, Partners) based on job title and location.
- **Optimization**: Complementary to property scraping. Used for finding corporate investors and office space leads.

## 4. News Intelligence: SerpAPI (Google News)
- **Key**: `SERPAPI_API_KEY`
- **Purpose**: Signal extraction from current events.
- **Usage**: Scans Google News for keywords like "UAE relocation", "Dubai luxury investment", and "New company launch".
- **Optimization**: Feeds results into Gemini for entity extraction, turning news mentions into actionable leads.

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
