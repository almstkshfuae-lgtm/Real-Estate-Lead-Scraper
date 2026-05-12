"use client";

import { useEffect, useState } from "react";
import QualificationForm from "@/components/search/QualificationForm";
import { Clock, History, ChevronRight, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function SearchPage() {
  const { t } = useTranslation('common');
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [selectedCriteria, setSelectedCriteria] = useState<any>(null);

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

  useEffect(() => {
    fetchRecent();
  }, []);

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
          <QualificationForm initialData={selectedCriteria} />
        </div>

        {/* Sidebar for Recent Searches */}
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-[var(--color-primary)]" />
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                {t('search.recent')}
              </h3>
            </div>

            <div className="space-y-4">
              {recentSearches.length > 0 ? (
                recentSearches.map((run) => (
                  <div
                    key={run.id}
                    className={`w-full text-start p-4 rounded-2xl border transition-all group ${selectedCriteria === run.criteria
                        ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(run.startedAt).toLocaleDateString()}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${run.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          run.status === 'PROCESSING' || run.status === 'PENDING' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                        {run.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1 mb-1">
                      {(Array.isArray(run.criteria?.propertyTypes) ? run.criteria.propertyTypes : []).join(", ") || "All Types"}
                    </p>
                    <div className="flex items-center justify-between mt-3 gap-2">
                      <button
                        onClick={() => setSelectedCriteria(run.criteria)}
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
            </div>

            {recentSearches.length > 0 && (
              <button
                onClick={fetchRecent}
                className="w-full mt-6 py-3 text-xs font-bold text-[var(--color-primary)] hover:underline"
              >
                {t('search.refreshHistory')}
              </button>
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
