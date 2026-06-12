"use client";

import { useState, useEffect } from "react";
import LeadTable, { Lead } from "@/components/leads/LeadTable";
import LeadPipeline from "@/components/leads/LeadPipeline";
import LeadSidebar from "@/components/leads/LeadSidebar";
import { isAdmin } from "@/lib/roles";
import { 
  Download, 
  Plus, 
  LayoutGrid, 
  List, 
  Search, 
  Filter, 
  RotateCcw,
  Loader2,
  RefreshCw,
  Thermometer,
  AlertCircle,
  Check
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CsvUpload from "@/components/leads/CsvUpload";
import { useScrapeRunStatus } from "@/hooks/useScrapeRunStatus";

export default function LeadsPage() {
  const { t } = useTranslation('common');
  const searchParams = useSearchParams();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Shared Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<number | "">("");
  const [scrapeRunIdFilter, setScrapeRunIdFilter] = useState(searchParams?.get("scrapeRunId") || "");
  const [refreshKey, setRefreshKey] = useState(0);
  const [scoreMinFilter, setScoreMinFilter] = useState<number>(0);
  const [excludeRentalFilter, setExcludeRentalFilter] = useState<boolean>(false);
  const [relocatedFilter, setRelocatedFilter] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const { status: runStatus, leadsFound, isPolling } = useScrapeRunStatus(scrapeRunIdFilter || null);

  // Auto-refresh table periodically when polling
  useEffect(() => {
    if (isPolling) {
      handleRefresh();
    }
  }, [leadsFound, isPolling]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return null;
        try {
          return await res.json();
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (data && data.user) setUser(data.user);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleRefresh = (updatedLead?: Lead) => {
    setRefreshKey(prev => prev + 1);
    if (updatedLead && selectedLead && selectedLead.id === updatedLead.id) {
      setSelectedLead(updatedLead);
    }
  };

  const exportLeads = async (format: 'csv' | 'xlsx') => {
    try {
      const toastId = (await import('sonner')).toast.loading(t('leads.exporting', 'Exporting...'));
      let url = "/api/export?format=" + format + "&search=" + encodeURIComponent(searchTerm);
      if (statusFilter) url += "&status=" + statusFilter;
      if (tierFilter) url += "&tier=" + tierFilter;
      if (scrapeRunIdFilter) url += "&scrapeRunId=" + scrapeRunIdFilter;
      if (scoreMinFilter > 0) url += "&scoreMin=" + scoreMinFilter;
      if (excludeRentalFilter) url += "&excludeRental=true";
      if (relocatedFilter) url += "&recentlyRelocated=true";
      const res = await fetch(url);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        (await import('sonner')).toast.success(t('leads.exportSuccess', 'Exported successfully'), { id: toastId });
      } else {
        throw new Error(data.error || 'Failed to export');
      }
    } catch (e: any) {
      (await import('sonner')).toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('leads.title')}</h1>
          <p className="text-[var(--color-text-secondary)]">{t('leads.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <div className="flex bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-border)]">
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <List className="w-3.5 h-3.5" />
              {t('common.viewList')}
            </button>
            <button 
              onClick={() => setView('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'kanban' ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('common.viewKanban')}
            </button>
          </div>

          <button 
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("");
              setTierFilter("");
              setScoreMinFilter(0);
              setExcludeRentalFilter(false);
              setRelocatedFilter(false);
              setScrapeRunIdFilter("");
              handleRefresh();
            }}
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-surface)] transition-all"
            title={t('common.clear', 'Clear Filters')}
          >
            <RotateCcw className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>

          {user && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportLeads('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button 
                onClick={() => exportLeads('xlsx')}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
              >
                <Download className="w-4 h-4" />
                XLSX
              </button>
            </div>
          )}
          {user && isAdmin(user.role) && <CsvUpload onSuccess={handleRefresh} />}

          <Link 
            href="/search"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            {t('leads.newScrape')}
          </Link>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center w-full">
          <div className="relative flex-1 w-full">
            <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder={t('leads.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:w-40 px-3 py-2.5 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            >
              <option value="">{t('leads.status.all', 'All Statuses')}</option>
              <option value="new">{t('leads.status.new')}</option>
              <option value="contacted">{t('leads.status.contacted')}</option>
              <option value="qualified">{t('leads.status.qualified')}</option>
              <option value="proposal">{t('leads.status.proposal')}</option>
              <option value="closed">{t('leads.status.closed')}</option>
            </select>
            
            <select 
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value ? parseInt(e.target.value) : "")}
              className="flex-1 md:w-40 px-3 py-2.5 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
            >
              <option value="">{t('leads.tiers.all', 'All Tiers')}</option>
              <option value="1">{t('leads.tiers.t1')}</option>
              <option value="2">{t('leads.tiers.t2')}</option>
              <option value="3">{t('leads.tiers.t3')}</option>
            </select>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                showAdvanced || scoreMinFilter > 0 || excludeRentalFilter || relocatedFilter
                  ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">{t('leads.filters', 'Filters')}</span>
              {(scoreMinFilter > 0 || excludeRentalFilter || relocatedFilter) && (
                <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {showAdvanced && (
          <div className="pt-4 border-t border-[var(--color-border)] grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* AI Min Score Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-[var(--color-text-secondary)]">
                <span>{t('map.filter.minScore', 'Min Score')}</span>
                <span className="text-[var(--color-primary)] bg-[var(--color-primary-subtle)] px-2 py-0.5 rounded-md text-[11px] font-black">
                  {scoreMinFilter > 0 ? `≥ ${scoreMinFilter}` : t('leads.status.all', 'All')}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={scoreMinFilter}
                onChange={(e) => setScoreMinFilter(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)] bg-[var(--color-bg-surface)] h-2 rounded-lg cursor-pointer appearance-none"
              />
            </div>

            {/* Exclude Rental behavior */}
            <div className="flex flex-col justify-end">
              <button
                onClick={() => setExcludeRentalFilter(!excludeRentalFilter)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all text-start ${
                  excludeRentalFilter
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <div>
                  <p>{t('search.excludeRental', 'Exclude Rental Behavior')}</p>
                  <p className="text-[9px] font-normal text-[var(--color-text-secondary)] mt-0.5">
                    {t('search.excludeRentalDesc', 'Hide leads with rental history')}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${excludeRentalFilter ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>
                  {excludeRentalFilter && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>

            {/* Recently Relocated */}
            <div className="flex flex-col justify-end">
              <button
                onClick={() => setRelocatedFilter(!relocatedFilter)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all text-start ${
                  relocatedFilter
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <div>
                  <p>{t('search.relocated', 'Recently Relocated')}</p>
                  <p className="text-[9px] font-normal text-[var(--color-text-secondary)] mt-0.5">
                    {t('search.relocatedDesc', 'Filter for leads new to UAE')}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${relocatedFilter ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)]'}`}>
                  {relocatedFilter && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Scrape Progress Banner */}
      {scrapeRunIdFilter && (isPolling || runStatus === "COMPLETED" || runStatus === "FAILED") && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-primary)] rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-4">
          <div className="absolute top-0 start-0 w-1 bg-[var(--color-primary)] h-full" />
          {isPolling ? (
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : runStatus === "COMPLETED" ? (
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Thermometer className="w-5 h-5 text-green-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          )}

          <div className="flex-1 text-center md:text-start">
            <h3 className="font-bold text-[var(--color-text-primary)]">
              {isPolling
                ? t("search.scrapeInProgress", "Scraping in progress...")
                : runStatus === "COMPLETED"
                ? t("search.scrapeComplete", "Scraping complete!")
                : t("search.scrapeFailed", "Scraping failed")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {isPolling
                ? t("search.scrapeWait", "Please wait while we extract data. Leads will appear automatically.")
                : runStatus === "COMPLETED"
                ? t("search.scrapeFound", "We found {{count}} leads.", { count: leadsFound })
                : t("search.scrapeErrorDesc", "An error occurred during the scrape job.")}
            </p>
          </div>

          <div className="text-center">
            <div className="text-3xl font-black text-[var(--color-primary)] leading-none">{leadsFound}</div>
            <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mt-1">
              {t("search.leadsFound", "Leads Found")}
            </div>
          </div>
          
          {!isPolling && (
            <button
              onClick={() => {
                // Clear filter so banner goes away and all leads are shown
                setScrapeRunIdFilter("");
              }}
              className="px-4 py-2 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] rounded-xl text-sm font-bold border border-[var(--color-border)] hover:bg-[var(--color-bg-card)] transition-colors ms-4"
            >
              {t("common.clear", "Clear Filter")}
            </button>
          )}
        </div>
      )}

      {/* Main View Area */}
      <div>
        {view === 'list' ? (
          <LeadTable 
            onSelectLead={(lead) => setSelectedLead(lead)} 
            filters={{ 
              searchTerm, 
              statusFilter, 
              tierFilter, 
              scrapeRunId: scrapeRunIdFilter, 
              refreshTrigger: refreshKey,
              scoreMin: scoreMinFilter,
              excludeRental: excludeRentalFilter,
              recentlyRelocated: relocatedFilter
            }}
          />
        ) : (
          <LeadPipeline 
            onSelectLead={(lead) => setSelectedLead(lead)} 
            filters={{ 
              searchTerm, 
              statusFilter, 
              tierFilter, 
              scrapeRunId: scrapeRunIdFilter, 
              refreshTrigger: refreshKey,
              scoreMin: scoreMinFilter,
              excludeRental: excludeRentalFilter,
              recentlyRelocated: relocatedFilter
            }}
          />
        )}
      </div>
      
      <LeadSidebar 
        lead={selectedLead} 
        userRole={user?.role}
        onClose={() => setSelectedLead(null)} 
        onUpdate={handleRefresh}
      />
    </div>
  );
}
