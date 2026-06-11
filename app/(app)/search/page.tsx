"use client";

import { useEffect, useState, useRef } from "react";
import QualificationForm from "@/components/search/QualificationForm";
import { Clock, History, ChevronRight, Download, Save, Trash2, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { toast } from "sonner";

export default function SearchPage() {
  const { t } = useTranslation('common');
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [selectedCriteria, setSelectedCriteria] = useState<any>(null);
  const [loadedCriteriaId, setLoadedCriteriaId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"runs" | "criteria">("runs");

  // Compute high failure alert locally on the first 5 runs (Point 4)
  const failedRunsCount = recentSearches.filter(r => r.status === "FAILED").length;
  const isHighFailureAlert = recentSearches.length >= 3 && (failedRunsCount / recentSearches.length) >= 0.5;

  const fetchRecent = async () => {
    try {
      const res = await fetch("/api/scrape-runs");
      if (res.ok) {
        const data = await res.json();
        setRecentSearches(data.runs.slice(0, 5));
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const fetchSaved = async () => {
    try {
      const res = await fetch("/api/search");
      if (res.ok) {
        const data = await res.json();
        setSavedSearches(data);
      }
    } catch (error) {
      console.error("Fetch saved searches error:", error);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      const res = await fetch(`/api/search?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t('common.deleted', 'Deleted successfully'));
        if (loadedCriteriaId === id) {
          setLoadedCriteriaId(null);
          setSelectedCriteria(null);
        }
        fetchSaved();
      } else {
        toast.error(t('search.deleteError', 'Failed to delete criteria'));
      }
    } catch (error) {
      console.error("Delete saved search error:", error);
      toast.error(t('search.deleteError', 'An unexpected error occurred.'));
    }
  };

  useEffect(() => {
    fetchRecent();
    fetchSaved();
  }, []);

  // Auto-refresh sidebar when any run is active (PROCESSING or PENDING)
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const hasActiveRun = recentSearches.some(
      (run) => run.status === 'PROCESSING' || run.status === 'PENDING'
    );

    if (hasActiveRun && !refreshIntervalRef.current) {
      refreshIntervalRef.current = setInterval(fetchRecent, 10000);
    } else if (!hasActiveRun && refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [recentSearches]);

  const loadCriteria = (criteria: any, id: string) => {
    setSelectedCriteria(criteria);
    setLoadedCriteriaId(id);
    toast.success(t('search.criteriaLoaded', 'Criteria loaded into form!'));
  };

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2 tracking-tight">
          {t('search.title')}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-lg">
          {t('search.subtitle')}
        </p>
      </div>

      {isHighFailureAlert && (
        <div className="max-w-4xl mx-auto bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-5 flex items-start gap-3 text-start animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-800 dark:text-red-300">
              {t('settings.scraper.highFailureAlert.title', 'High Scraper Failure Rate Alert')}
            </h4>
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('settings.scraper.highFailureAlert.desc', 'Warning: {{failedCount}} of the last {{totalCount}} scrape runs have failed. Please check the scraper service connection, verify source configurations, or review the execution logs.', { failedCount: failedRunsCount, totalCount: recentSearches.length })}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto mb-12">
        <QualificationForm initialData={selectedCriteria} onSaveSuccess={fetchSaved} />
      </div>

      <div className="border-t border-[var(--color-border)] pt-12">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            
            {/* History & Saved Criteria Area */}
            <div className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm w-full">
              {/* Tabs Header */}
              <div className="flex border-b border-[var(--color-border)] mb-6 gap-2">
                <button
                  onClick={() => setActiveTab("runs")}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider flex-1 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "runs"
                      ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  {t('settings.scraper.recent', 'Recent Runs')}
                </button>
                <button
                  onClick={() => setActiveTab("criteria")}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider flex-1 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === "criteria"
                      ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                      : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" />
                  {t('search.savedCriteriaSidebar', 'Saved Criteria')}
                </button>
              </div>

              {/* Tab content: Runs */}
              {activeTab === "runs" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentSearches.length > 0 ? (
                    recentSearches.map((run) => (
                      <div
                        key={run.id}
                        className={`w-full text-start p-4 rounded-2xl border transition-all group flex flex-col ${
                          loadedCriteriaId === run.id
                            ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(run.startedAt).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              run.status === 'PROCESSING' || run.status === 'PENDING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                            {(run.status === 'PROCESSING' || run.status === 'PENDING') && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                              </span>
                            )}
                            {run.status}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-2 mb-4 flex-1">
                          {(Array.isArray(run.criteria?.propertyTypes) ? run.criteria.propertyTypes : []).join(", ") || "All Property Types"}
                        </p>
                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            onClick={() => loadCriteria(run.criteria, run.id)}
                            className="text-[11px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors px-3 py-2 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex-1 text-center"
                          >
                            {t('search.loadCriteria', 'Load Criteria')}
                          </button>
                          <Link
                            href={`/leads?scrapeRunId=${run.id}`}
                            className="text-[11px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors px-3 py-2 rounded-xl flex-1 text-center shadow-md shadow-blue-500/20"
                          >
                            {t('search.viewLeads', 'View Leads')} ({run.leadsFound})
                          </Link>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center">
                      <p className="text-sm text-[var(--color-text-disabled)] italic">{t('search.noRecent')}</p>
                    </div>
                  )}

                  {recentSearches.length > 0 && (
                    <div className="col-span-full">
                      <button
                        onClick={fetchRecent}
                        className="mx-auto mt-4 py-2 px-4 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] rounded-xl transition-colors flex items-center gap-1"
                      >
                        {t('search.refreshHistory', 'Refresh History')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab content: Saved Criteria */}
              {activeTab === "criteria" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedSearches.length > 0 ? (
                    savedSearches.map((item) => (
                      <div
                        key={item.id}
                        className={`w-full text-start p-4 rounded-2xl border transition-all group flex flex-col ${
                          loadedCriteriaId === item.id
                            ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {loadedCriteriaId === item.id && (
                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              {t('common.connected', 'Active')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)] line-clamp-1 mb-1">
                          {(Array.isArray(item.criteria?.propertyTypes) ? item.criteria.propertyTypes : []).join(", ") || "All Types"}
                        </p>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-4 flex-1">
                          AED {Number(item.criteria?.budgetMin || 0).toLocaleString()} - {Number(item.criteria?.budgetMax || 0).toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2 mt-auto">
                          <button
                            onClick={() => loadCriteria(item.criteria, item.id)}
                            className="text-[11px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors px-3 py-2 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex-1 text-center"
                          >
                            {t('search.loadCriteria', 'Load')}
                          </button>
                          <button
                            onClick={() => handleDeleteSaved(item.id)}
                            className="text-[11px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors p-2 rounded-xl border border-transparent hover:border-red-200 dark:hover:border-red-900"
                            title={t('common.delete', 'Delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center">
                      <p className="text-sm text-[var(--color-text-disabled)] italic">{t('search.noSaved', 'No saved criteria yet.')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Pro Tip Side Panel */}
            <div className="w-full md:w-80 p-6 rounded-3xl bg-gradient-to-br from-[#185FA5] to-[#144b82] text-white shadow-xl shadow-blue-500/10 shrink-0">
              <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                {t('search.proTip', 'Pro Tip')}
              </h4>
              <p className="text-sm text-blue-100 leading-relaxed font-medium">
                {t('search.proTipDesc', 'Save your most successful search criteria combinations to reuse them later. Tracking specific neighborhoods or budget ranges? Hit "Save Criteria" at the bottom of the form.')}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
