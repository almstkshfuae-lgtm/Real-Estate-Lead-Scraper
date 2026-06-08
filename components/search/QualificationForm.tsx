"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  DollarSign,
  MapPin,
  Zap,
  Filter,
  Play,
  Save,
  Info,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import { useScrapeRunStatus } from "@/hooks/useScrapeRunStatus";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, Globe, ChevronDown, ChevronUp } from "lucide-react";

const SOURCE_NAMES: Record<string, string> = {
  adec: 'ADEC',
  rotary: 'Rotary Club',
  whatson: "What's On",
  artsclub: 'Arts Club',
  dhabianequi: 'Dhabian Equestrian',
  alhabtoor: 'Al Habtoor',
  adgm: 'ADGM',
  difc: 'DIFC',
  ded: 'DED License Portal',
  gazette: 'Official Gazette',
  propertymonitor: 'Property Monitor',
};

const SOURCE_CATEGORIES = [
  {
    title: 'Government & Regulatory',
    sources: ['adec', 'ded', 'gazette']
  },
  {
    title: 'Free Zones & Business',
    sources: ['adgm', 'difc', 'alhabtoor']
  },
  {
    title: 'Clubs & Associations',
    sources: ['artsclub', 'rotary', 'dhabianequi']
  },
  {
    title: 'Real Estate & Media',
    sources: ['propertymonitor', 'whatson']
  }
];

const DEFAULT_SCRAPE_SOURCES = [
  'adec',
  'rotary',
  'whatson',
  'artsclub',
  'dhabianequi',
  'alhabtoor',
  'adgm',
  'difc',
  'ded',
  'gazette',
  'propertymonitor',
];

export default function QualificationForm({ initialData, onSaveSuccess }: { initialData?: any; onSaveSuccess?: () => void }) {
  const router = useRouter();
  const { t } = useTranslation('common');
  const searchParams = useSearchParams();
  const queryKeywords = searchParams?.get("keywords") || "";

  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialData?.propertyTypes || []);
  const [budgetMin, setBudgetMin] = useState<number>(initialData?.budgetMin || 1000000);
  const [budgetMax, setBudgetMax] = useState<number>(initialData?.budgetMax || 10000000);
  const [emirates, setEmirates] = useState<string[]>(initialData?.emirates || []);
  const [relocated, setRelocated] = useState(initialData?.relocated || false);
  const [excludeRental, setExcludeRental] = useState(initialData?.excludeRental || true);
  const [keywords, setKeywords] = useState<string>(initialData?.keywords || "");
  const [showSourcesConfig, setShowSourcesConfig] = useState(false);

  // Sync state if initialData changes
  useEffect(() => {
    if (initialData) {
      setPropertyTypes(initialData.propertyTypes || []);
      setBudgetMin(initialData.budgetMin || 1000000);
      setBudgetMax(initialData.budgetMax || 10000000);
      setEmirates(initialData.emirates || []);
      setRelocated(initialData.relocated || false);
      setExcludeRental(initialData.excludeRental || true);
      setKeywords(initialData.keywords || "");
    }
  }, [initialData]);

  useEffect(() => {
    if (queryKeywords) {
      setKeywords(queryKeywords);
    }
  }, [queryKeywords]);

  const toggleType = (type: string) => {
    setPropertyTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleEmirate = (emirate: string) => {
    setEmirates(prev =>
      prev.includes(emirate) ? prev.filter(e => e !== emirate) : [...prev, emirate]
    );
  };

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { status: runStatus, leadsFound, isPolling } = useScrapeRunStatus(activeRunId);
  const [activeSources, setActiveSources] = useState<string[]>(DEFAULT_SCRAPE_SOURCES);
  const [userRole, setUserRole] = useState<string>("");
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (data && data.user) {
          setUserRole((data.user.role || "agent").toLowerCase());
        }
        setLoadingUser(false);
      })
      .catch(err => {
        console.error("Error loading user in QualificationForm:", err);
        setLoadingUser(false);
      });

    fetch("/api/scrape")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.sources) && data.sources.length > 0) {
          // Use key field from source config objects if it's an array of objects
          const sourceKeys = data.sources.map((src: any) => typeof src === 'string' ? src : src.key);
          setActiveSources(sourceKeys);
        }
      })
      .catch(err => console.error("Error loading active sources:", err));
  }, []);

  const handleSave = async (isScrape = false) => {
    setLoading(true);
    let toastId: string | number | undefined;
    try {
      const criteria = {
        propertyTypes,
        budgetMin,
        budgetMax,
        emirates,
        relocated,
        excludeRental,
        keywords,
      };

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });

      let scrapeRes;
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        onSaveSuccess?.();

        if (!isScrape) {
          toast.success(t('search.savedSuccess', 'Search criteria saved!'));
          return;
        }

        toastId = toast.loading(t('search.scrapeInitializing', 'Initializing scrape job...'));

        scrapeRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sources: activeSources, criteria }),
        });
        const scrapeData = await safeJson(scrapeRes);

        if (scrapeData.warning) {
          // Scraper service is offline — job queued
          toast.warning(
            t('search.scrapeOffline', 'Scraper service offline. Job queued — it will run when the service comes back online.'),
            { id: toastId, duration: 6000 }
          );
          if (scrapeData.runId) setActiveRunId(scrapeData.runId);
        } else if (scrapeRes.ok) {
          toast.success(
            t('search.scrapeStarted', 'Scrape job started! Tracking progress below.'),
            { id: toastId, duration: 5000 }
          );
          // Capture runId for live polling — do NOT navigate immediately
          if (scrapeData.runId) setActiveRunId(scrapeData.runId);
        } else {
          toast.error(
            scrapeData.error || t('search.scrapeError', 'Failed to start scrape job.'),
            { id: toastId }
          );
        }
      } else {
        toast.error(t('search.saveError', 'Failed to save search criteria.'));
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error?.message || t('search.saveError', 'An unexpected error occurred.'), toastId ? { id: toastId } : undefined);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'apartment', label: t('search.types.apartment', 'Apartment') },
    { id: 'villa', label: t('search.types.villa', 'Villa') },
    { id: 'townhouse', label: t('search.types.townhouse', 'Townhouse') },
    { id: 'penthouse', label: t('search.types.penthouse', 'Penthouse') },
    { id: 'commercial', label: t('search.types.commercial', 'Commercial') },
  ];

  const emirateOptions = [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'
  ];

  if (loadingUser) {
    return (
      <div className="max-w-4xl mx-auto p-8 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] rounded-xl flex items-center justify-center">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('search.title')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t('search.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Target Keywords */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <Search className="w-4 h-4" />
                {t('search.keywordsLabel', 'Target Keywords')}
              </label>
              <input
                type="text"
                placeholder={t('search.keywordsPlaceholder', 'e.g., luxury, penthouses, DIFC, investor')}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
              />
              <p className="text-[10px] text-[var(--color-text-secondary)]">
                {t('search.keywordsDesc', 'Filter pre-enriched leads to match any of these comma-separated keywords.')}
              </p>
            </div>

            {/* Property Types */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                {t('search.propertyType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {types.map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`filter-btn ${propertyTypes.includes(type.id) ? "active" : ""
                      }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Range */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                {t('search.budget')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase ml-1">Min</p>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase ml-1">Max</p>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Emirates */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <MapPin className="w-4 h-4" />
                {t('search.emirates')}
              </label>
              <div className="flex flex-wrap gap-2">
                {emirateOptions.map(emirate => (
                  <button
                    key={emirate}
                    onClick={() => toggleEmirate(emirate)}
                    className={`emirate-pill ${emirates.includes(emirate) ? "active" : ""
                      }`}
                  >
                    {emirate}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Toggles */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <Zap className="w-4 h-4" />
                {t('search.options')}
              </label>

              <div className="space-y-4">
                <button
                  onClick={() => setRelocated(!relocated)}
                  className={`toggle-card ${relocated ? "active-success" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`toggle-icon-container ${relocated ? 'active-success' : ''}`}>
                      <Info className="w-4 h-4" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-bold toggle-title">{t('search.relocated')}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{t('search.relocatedDesc')}</p>
                    </div>
                  </div>
                  <div className={`toggle-switch-track ${relocated ? 'active-success' : ''}`}>
                    <div className={`toggle-switch-thumb ${relocated ? 'active' : 'inactive'}`}></div>
                  </div>
                </button>

                <button
                  onClick={() => setExcludeRental(!excludeRental)}
                  className={`toggle-card ${excludeRental ? "active-primary" : ""
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`toggle-icon-container ${excludeRental ? 'active-primary' : ''}`}>
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="text-start">
                      <p className="text-sm font-bold toggle-title">{t('search.excludeRental')}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{t('search.excludeRentalDesc')}</p>
                    </div>
                  </div>
                  <div className={`toggle-switch-track ${excludeRental ? 'active-primary' : ''}`}>
                    <div className={`toggle-switch-thumb ${excludeRental ? 'active' : 'inactive'}`}></div>
                  </div>
                </button>
              </div>
            </div>

            {/* Summary Box removed per user request */}
          </div>
        </div>

        {/* ── Active Sources Collapsible Configuration ── */}
        <div className="border border-[var(--color-border)] rounded-3xl p-6 bg-[var(--color-bg-card)]">
          <button
            onClick={() => setShowSourcesConfig(!showSourcesConfig)}
            className="w-full flex items-center justify-between text-start font-bold text-sm text-[var(--color-text-primary)]"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[var(--color-primary)]" />
              <span>
                {t('search.configureSourcesBtn', 'Configure Scrape Sources')} ({activeSources.length}/{DEFAULT_SCRAPE_SOURCES.length})
              </span>
            </div>
            {showSourcesConfig ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showSourcesConfig && (
            <div className="mt-6 space-y-6 pt-6 border-t border-[var(--color-border)] animate-in fade-in-0 duration-200">
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveSources(DEFAULT_SCRAPE_SOURCES)}
                  className="px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
                >
                  {t('search.selectAll', 'Select All')}
                </button>
                <button
                  onClick={() => setActiveSources([])}
                  className="px-3 py-1.5 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
                >
                  {t('search.deselectAll', 'Deselect All')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {SOURCE_CATEGORIES.map((category) => (
                  <div key={category.title} className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/20 space-y-4 shadow-sm">
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] pb-2 border-b border-[var(--color-border)]/50">
                      {category.title}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {category.sources.map((sourceKey) => {
                        const isChecked = activeSources.includes(sourceKey);
                        return (
                          <label
                            key={sourceKey}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked
                              ? 'bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]'
                              : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-disabled)]'
                              }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setActiveSources((prev) =>
                                  prev.includes(sourceKey)
                                    ? prev.filter((k) => k !== sourceKey)
                                    : [...prev, sourceKey]
                                );
                              }}
                              className="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <span className="text-xs font-bold text-[var(--color-text-primary)]">
                              {SOURCE_NAMES[sourceKey] || sourceKey}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Live Progress Banner ── */}
        {activeRunId && (
          <div className="mt-8 rounded-2xl border overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-300">
            {runStatus === 'COMPLETED' ? (
              <div className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm font-bold text-green-800 dark:text-green-300">
                      {t('search.scrapeComplete', 'Scrape complete')}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      {leadsFound} {t('search.leadsFound', 'leads found')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => router.push(`/leads?scrapeRunId=${activeRunId}`)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-md"
                >
                  {t('search.viewLeads', 'View Leads')} <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : runStatus === 'FAILED' ? (
              <div className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-bold text-red-800 dark:text-red-300">
                      {t('search.scrapeFailed', 'Scrape failed')}
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {leadsFound > 0
                        ? `${leadsFound} ${t('search.leadsFoundPartial', 'leads found before failure')}`
                        : t('search.noLeadsFound', 'No leads were extracted')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setActiveRunId(null); handleSave(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t('search.retry', 'Retry')}
                </button>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                    <div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                        {runStatus === 'PENDING'
                          ? t('search.scrapeQueued', 'Scrape queued — waiting for slot...')
                          : t('search.scrapeProcessing', 'Scraping sources...')}
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {leadsFound > 0
                          ? `${leadsFound} ${t('search.leadsFoundSoFar', 'leads found so far')}`
                          : t('search.extractingData', 'Extracting data from websites...')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse"
                        style={{ animationDelay: `${i * 300}ms` }}
                      />
                    ))}
                  </div>
                </div>
                {/* Progress bar simulation */}
                <div className="mt-3 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 dark:bg-blue-400 rounded-full animate-progress-indeterminate" />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 flex gap-4">
          <button
            disabled={loading || isPolling}
            onClick={() => handleSave(true)}
            className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl hover:bg-[var(--color-primary-hover)] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
            {loading ? t('search.scrapeInitializing') : isPolling ? t('search.scrapeInProgress', 'Scrape in progress...') : t('search.startScrape')}
          </button>
          <button
            disabled={loading}
            onClick={() => handleSave(false)}
            className={`px-6 py-4 border border-[var(--color-border)] font-bold rounded-2xl transition-all flex items-center justify-center ${saveSuccess ? 'text-green-500 border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800' : 'bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]'}`}
          >
            {saveSuccess ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
