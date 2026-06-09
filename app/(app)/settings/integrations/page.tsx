"use client";

import React from "react";
import { useState, useEffect } from "react";
import { ShieldCheck, Database, Link2, MessageSquare, Mail, KeyRound, Globe, Save, Loader2, PlayCircle, CheckCircle2, MessageCircle, Coins, TrendingUp, Gauge, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";

export default function IntegrationsSettingsPage() {
  const { t } = useTranslation('common');

  const [integrations, setIntegrations] = useState({
    googleAiApiKey: "",
    scraperServiceUrl: "",
    scraperSecret: "",
    proxyServiceUrl: "",
    proxyApiKey: "",
    bitrixDomain: "",
    bitrixToken: "",
    bitrixPushMode: "contacts",
    whatsappPhoneId: "",
    whatsappToken: "",
    smtpHost: "",
    smtpUser: "",
    smtpPass: "",
    uaeComplianceMode: false,
    globalRateLimitDelay: 3000,
    aiDailyBudgetUsd: 5.0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [usageStats, setUsageStats] = useState<any>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({
    scraper: 'idle',
    bitrix: 'idle',
    whatsapp: 'idle',
    smtp: 'idle'
  });

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.integrations) {
          // Check for a sessionStorage draft (unsaved edits from before navigation)
          const draft = typeof window !== 'undefined' ? sessionStorage.getItem('integrations-draft') : null;
          if (draft) {
            try {
              const parsed = JSON.parse(draft);
              setIntegrations({ ...data.integrations, ...parsed });
            } catch {
              setIntegrations(data.integrations);
            }
          } else {
            setIntegrations(data.integrations);
          }
        }
      })
      .catch(err => {
        console.error("Failed to fetch integrations:", err);
        window.location.href = "/leads";
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/ai/usage")
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch usage stats");
        return res.json();
      })
      .then(data => {
        setUsageStats(data);
      })
      .catch(err => {
        console.error("Failed to fetch AI usage stats:", err);
      })
      .finally(() => setIsLoadingUsage(false));
  }, []);

  const handleChange = (key: keyof typeof integrations, value: any) => {
    setIntegrations(prev => {
      const next = { ...prev, [key]: value };
      // Persist draft to sessionStorage to survive navigation
      try { sessionStorage.setItem('integrations-draft', JSON.stringify(next)); } catch { }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations })
      });
      if (!res.ok) throw new Error("Failed to save");
      // Clear sessionStorage draft on successful save
      try { sessionStorage.removeItem('integrations-draft'); } catch { }
      toast.success(t('settings.integrations.saved', 'Integrations updated successfully.'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const handleTest = async (system: 'scraper' | 'bitrix' | 'whatsapp' | 'smtp') => {
    // Prevent concurrent tests on the same system (race condition guard)
    if (testStatus[system] === 'testing') return;
    setTestStatus(prev => ({ ...prev, [system]: 'testing' }));

    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          config: integrations
        })
      });

      const data = await safeJson(res).catch(() => ({} as any));

      if (data.success) {
        setTestStatus(prev => ({ ...prev, [system]: 'success' }));
        toast.success(t(`settings.integrations.testSuccess.${system}`, `Successfully connected to ${system.toUpperCase()}`));
      } else {
        setTestStatus(prev => ({ ...prev, [system]: 'error' }));
        toast.error(t(`settings.integrations.testError.${system}`, `Failed to connect to ${system.toUpperCase()}`));
      }
    } catch (err: any) {
      setTestStatus(prev => ({ ...prev, [system]: 'error' }));
      toast.error(err.message);
    } finally {
      // Reset status after a few seconds
      setTimeout(() => {
        setTestStatus(prev => ({ ...prev, [system]: 'idle' }));
      }, 3000);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('settings.integrations.title', 'Integrations')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('settings.integrations.subtitle', 'Connect Brilliance to your CRM and outreach channels.')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
        </button>
      </div>

      {/* Intelligence & Scraping */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Intelligence & Scraping</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Core AI brain and data extraction engine settings.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Gemini API Key</label>
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">AI Engine</span>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="AIza... or bearer token"
                value={integrations.googleAiApiKey}
                onChange={(e) => handleChange('googleAiApiKey', e.target.value)}
                className="w-full h-10 px-3 ps-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute start-3 top-3" />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">Powers Gemini-driven scoring, signal extraction, pitches, and chatbot responses.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Internal Scraper URL</label>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Playwright Service</span>
            </div>
            <input
              type="text"
              placeholder="http://localhost:3002"
              value={integrations.scraperServiceUrl}
              onChange={(e) => handleChange('scraperServiceUrl', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)]">Service endpoint for the internal Abu Dhabi-focused Playwright scraper.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Scraper Secret</label>
              <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Auth</span>
            </div>
            <div className="relative">
              <input
                type="password"
                placeholder="scraper_secret_alpha_bravo"
                value={integrations.scraperSecret}
                onChange={(e) => handleChange('scraperSecret', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">Used to authenticate requests between the app and the scraper microservice.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Proxy Service URL</label>
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Bot Bypass</span>
            </div>
            <input
              type="text"
              placeholder="https://proxy.example.com"
              value={integrations.proxyServiceUrl}
              onChange={(e) => handleChange('proxyServiceUrl', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)]">Optional residential proxy endpoint for bypassing anti-bot protections.</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]">Proxy API Key</label>
              <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Residential Proxy</span>
            </div>
            <div className="relative">
              <input
                type="password"
                value={integrations.proxyApiKey}
                onChange={(e) => handleChange('proxyApiKey', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">Authentication for a managed proxy pool or rotating residential proxy service.</p>
          </div>
        </div>
        <div className="pt-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {testStatus.scraper === 'success' && (
              <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm font-medium text-green-800">
                <CheckCircle2 className="w-4 h-4" />
                Scraper service ready
              </div>
            )}
          </div>
          <button
            onClick={() => handleTest('scraper')}
            disabled={testStatus.scraper === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.scraper === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.scraper === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            Test Scraper Service
          </button>
        </div>
      </div>

      {/* AI Cost Controls & Usage */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">AI Cost Controls & Usage</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Set daily budgets and monitor cumulative Gemini API consumption.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 text-start">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Daily AI Budget Cap (USD)</label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.1"
                placeholder="5.00"
                value={integrations.aiDailyBudgetUsd}
                onChange={(e) => handleChange('aiDailyBudgetUsd', parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <p className="text-[11px] text-[var(--color-text-secondary)]">Daily cumulative cost cap across pitches, scores, signals, and chat responses.</p>
          </div>

          <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 flex flex-col justify-between text-start">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">Today's Estimated Cost</span>
              <span className="text-xs font-bold text-[var(--color-text-primary)]">
                ${usageStats?.today?.estimatedCostUsd.toFixed(4) || "0.0000"} / ${Number(integrations.aiDailyBudgetUsd || 5).toFixed(2)}
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-[var(--color-border)] h-2.5 rounded-full overflow-hidden mt-2">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${usageStats?.budget?.exceeded ? 'bg-red-500' : 'bg-[var(--color-primary)]'}`}
                style={{ width: `${Math.min(100, ((usageStats?.today?.estimatedCostUsd || 0) / (integrations.aiDailyBudgetUsd || 5)) * 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center mt-2 text-[10px] text-[var(--color-text-secondary)]">
              <span>{usageStats?.today?.totalTokens.toLocaleString() || 0} tokens consumed today</span>
              {usageStats?.budget?.exceeded && (
                <span className="text-red-500 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Budget Exceeded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Daily Breakdown Table */}
        <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 text-start">
            <TrendingUp className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Last 7 Days Daily Breakdown</h3>
          </div>
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-start">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/50">
                  <th className="p-3 font-bold text-[var(--color-text-secondary)]">Date</th>
                  <th className="p-3 font-bold text-[var(--color-text-secondary)] text-right">Tokens Used</th>
                  <th className="p-3 font-bold text-[var(--color-text-secondary)] text-right">Est. Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {usageStats?.daily?.length > 0 ? (
                  usageStats.daily.map((day: any) => (
                    <tr key={day.date} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-surface)]/30">
                      <td className="p-3 text-[var(--color-text-primary)] font-medium">{day.date}</td>
                      <td className="p-3 text-[var(--color-text-secondary)] text-right">{day.totalTokens.toLocaleString()}</td>
                      <td className="p-3 text-[var(--color-text-primary)] text-right font-medium">${day.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-[var(--color-text-secondary)]">
                      {isLoadingUsage ? "Loading stats..." : "No usage recorded."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Task Breakdown */}
        {usageStats?.tasks?.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
            <div className="flex items-center gap-2 text-start">
              <Gauge className="w-4 h-4 text-[var(--color-text-secondary)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Usage by Task Type</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start">
              {usageStats.tasks.map((t: any) => (
                <div key={t.taskType} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30">
                  <div className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] tracking-wider">{t.taskType}</div>
                  <div className="text-sm font-bold text-[var(--color-text-primary)] mt-1">${t.estimatedCostUsd.toFixed(4)}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{t.totalTokens.toLocaleString()} tokens</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compliance & Rate-Limiting */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Compliance & Rate-Limiting</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Manage UAE legal protection settings and scraping speeds.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-start">
            <input
              type="checkbox"
              id="uaeComplianceMode"
              checked={!!integrations.uaeComplianceMode}
              onChange={(e) => handleChange('uaeComplianceMode', e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-[var(--color-primary)] border-[var(--color-border)] focus:ring-[var(--color-primary)] cursor-pointer"
            />
            <div className="space-y-1">
              <label htmlFor="uaeComplianceMode" className="text-sm font-bold text-[var(--color-text-primary)] cursor-pointer">
                UAE PDPL Compliance Mode
              </label>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                When enabled, automatically skips scraping from sources with strict anti-scraping terms (e.g. Bayut, Dubizzle) to ensure regulatory compliance with UAE data protection laws.
              </p>
            </div>
          </div>

          <div className="space-y-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-start">
            <label className="text-sm font-bold text-[var(--color-text-primary)]">
              Global Scraping Delay (ms)
            </label>
            <input
              type="number"
              min="500"
              max="30000"
              value={integrations.globalRateLimitDelay ?? 3000}
              onChange={(e) => handleChange('globalRateLimitDelay', parseInt(e.target.value, 10) || 3000)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            <p className="text-xs text-[var(--color-text-secondary)]">
              Enforces a minimum pause (in milliseconds) between crawling consecutive pages to prevent rate limits and IP bans.
            </p>
          </div>
        </div>
      </div>

      {/* Bitrix24 Integration */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2FC6F6]/10 text-[#2FC6F6] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Bitrix24 CRM</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.bitrixDesc', 'Push leads to Bitrix24 as Contacts or Deals.')}</p>
            </div>
          </div>
          {testStatus.bitrix === 'success' && <Badge className="bg-green-100 text-green-800 border-green-200">{t('settings.integrations.connected', 'Connected')}</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.bitrixDomain', 'Bitrix24 Domain')}</label>
            <div className="relative">
              <input
                type="text"
                value={integrations.bitrixDomain}
                onChange={(e) => handleChange('bitrixDomain', e.target.value)}
                className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.apiToken', 'API Token / Webhook ID')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.bitrixToken}
                onChange={(e) => handleChange('bitrixToken', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.pushMode', 'Push Mode')}</label>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { id: 'contacts', label: t('settings.integrations.contactsOnly', 'Contacts Only (Recommended)') },
              { id: 'deals', label: t('settings.integrations.contactsDeals', 'Contacts + Deals') },
              { id: 'off', label: t('settings.integrations.off', 'Off') }
            ].map((mode) => (
              <label key={mode.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bitrixPushMode"
                  value={mode.id}
                  checked={integrations.bitrixPushMode === mode.id}
                  onChange={(e) => handleChange('bitrixPushMode', e.target.value)}
                  className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{mode.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('bitrix')}
            disabled={testStatus.bitrix === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.bitrix === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.bitrix === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>

      {/* WhatsApp Business API */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">WhatsApp Business Cloud</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.whatsappDesc', 'Send templated messages directly to leads.')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.phoneId', 'Phone Number ID')}</label>
            <div className="relative">
              <input
                type="text"
                value={integrations.whatsappPhoneId}
                onChange={(e) => handleChange('whatsappPhoneId', e.target.value)}
                className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.whatsappToken', 'Access Token')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.whatsappToken}
                onChange={(e) => handleChange('whatsappToken', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('whatsapp')}
            disabled={testStatus.whatsapp === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.whatsapp === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.whatsapp === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>

      {/* SMTP Email */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-500/10 text-gray-500 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">SMTP Email</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.smtpDesc', 'Configure outgoing email for campaigns and alerts.')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpHost', 'SMTP Host')}</label>
            <input
              type="text"
              value={integrations.smtpHost}
              onChange={(e) => handleChange('smtpHost', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpUser', 'SMTP Username')}</label>
            <input
              type="text"
              value={integrations.smtpUser}
              onChange={(e) => handleChange('smtpUser', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpPass', 'SMTP Password')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.smtpPass}
                onChange={(e) => handleChange('smtpPass', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <KeyRound className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('smtp')}
            disabled={testStatus.smtp === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.smtp === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.smtp === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>
    </div>
  );
}

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${className}`}>{children}</span>
}
