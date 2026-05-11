"use client";

import { useEffect, useState } from "react";
import QualificationForm from "@/components/search/QualificationForm";
import { Clock, History, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function SearchPage() {
  const { t } = useTranslation('common');
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [selectedCriteria, setSelectedCriteria] = useState<any>(null);

  const fetchRecent = async () => {
    try {
      const res = await fetch("/api/search");
      if (res.ok) {
        const data = await res.json();
        setRecentSearches(data);
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
                recentSearches.map((search) => (
                  <button 
                    key={search.id}
                    onClick={() => setSelectedCriteria(search.criteria)}
                    className={`w-full text-start p-4 rounded-2xl border transition-all group ${
                      selectedCriteria === search.criteria 
                        ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]" 
                        : "border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 hover:bg-[var(--color-bg-surface)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(search.createdAt).toLocaleDateString()}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-disabled)] group-hover:text-[var(--color-primary)] transition-colors rtl-mirror" />
                    </div>
                    <p className="text-xs font-bold text-[var(--color-text-primary)] line-clamp-1">
                      {search.criteria.propertyTypes.join(", ") || "All Types"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                      {search.criteria.emirates.join(", ") || "All Emirates"}
                    </p>
                  </button>
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
