"use client";

import { useEffect, useState, useRef } from "react";
import QualificationForm from "@/components/search/QualificationForm";
import { Clock, History, ChevronRight, Download, Save, Trash2, Check } from "lucide-react";
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3">
          <QualificationForm initialData={selectedCriteria} onSaveSuccess={fetchSaved} />
        </div>

        {/* Sidebar for Recent Searches / Saved Criteria */}
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
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
                {t('search.savedCriteriaSidebar', 'Saved')}
              </button>
            </div>

            {/* Tab content: Runs */}
            {activeTab === "runs" && (
              <div className="space-y-4">
                {recentSearches.length > 0 ? (
                  recentSearches.map((run) => (
                    <div
                      key={run.id}
                      className={`w-full text-start p-4 rounded-2xl border transition-all group ${
                        loadedCriteriaId === run.id
                          ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
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
                      <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1 mb-1">
                        {(Array.isArray(run.criteria?.propertyTypes) ? run.criteria.propertyTypes : []).join(", ") || "All Types"}
                      </p>
                      <div className="flex items-center justify-between mt-3 gap-2">
                        <button
                          onClick={() => loadCriteria(run.criteria, run.id)}
                          className="text-[10px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors px-2 py-1.5 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)] flex-1 text-center"
                        >
                          {t('search.loadCriteria', 'Load Criteria')}
                        </button>
                        <Link
                          href={`/leads?scrapeRunId=${run.id}`}
                          className="text-[10px] font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] transition-colors px-2 py-1.5 rounded-lg flex-1 text-center shadow-md shadow-blue-500/20"
                        >
                          {t('search.viewLeads', 'View Leads')} ({run.leadsFound})
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-[var(--color-text-disabled)] italic">{t('search.noRecent')}</p>
                  </div>
                )}

                {recentSearches.length > 0 && (
                  <button
                    onClick={fetchRecent}
                    className="w-full mt-2 py-2 text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center justify-center gap-1"
                  >
                    {t('search.refreshHistory')}
                  </button>
                )}
              </div>
            )}

            {/* Tab content: Saved Criteria */}
            {activeTab === "criteria" && (
              <div className="space-y-4">
                {savedSearches.length > 0 ? (
                  savedSearches.map((item) => (
                    <div
                      key={item.id}
                      className={`w-full text-start p-4 rounded-2xl border transition-all group ${
                        loadedCriteriaId === item.id
                          ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
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
                      <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1 mb-1">
                        {(Array.isArray(item.criteria?.propertyTypes) ? item.criteria.propertyTypes : []).join(", ") || "All Types"}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">
                        AED {Number(item.criteria?.budgetMin || 0).toLocaleString()} - {Number(item.criteria?.budgetMax || 0).toLocaleString()}
                      </p>
                      <div className="flex items-center justify-between mt-3 gap-2">
                        <button
                          onClick={() => loadCriteria(item.criteria, item.id)}
                          className="text-[10px] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors px-2 py-1.5 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)] flex-1 text-center"
                        >
                          {t('search.loadCriteria', 'Load')}
                        </button>
                        <button
                          onClick={() => handleDeleteSaved(item.id)}
                          className="text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors p-1.5 rounded-lg border border-transparent hover:border-red-200 dark:hover:border-red-900"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-xs text-[var(--color-text-disabled)] italic">{t('search.noSaved', 'No saved criteria yet.')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-blue-600 text-white shadow-xl shadow-blue-500/10">
            <h4 className="font-bold mb-2">{t('search.proTip')}</h4>
            <p className="text-xs text-blue-100 leading-relaxed">
              {t('search.proTipDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
