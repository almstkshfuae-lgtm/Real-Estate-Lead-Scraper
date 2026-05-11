"use client";

import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Calendar, Filter } from "lucide-react";
import Link from "next/link";

export default function ExportHistoryPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/export/history")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.history) {
          setHistory(data.history);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('settings.exportHistory.title', 'Export History')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('settings.exportHistory.subtitle', 'View and download previously exported lead data.')}
          </p>
        </div>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] font-medium border-b border-[var(--color-border)]">
              <tr>
                <th className="px-6 py-4">{t('exportHistory.date', 'Date')}</th>
                <th className="px-6 py-4">{t('exportHistory.format', 'Format')}</th>
                <th className="px-6 py-4">{t('exportHistory.records', 'Records')}</th>
                <th className="px-6 py-4">{t('exportHistory.filters', 'Filters Applied')}</th>
                <th className="px-6 py-4 text-end">{t('exportHistory.action', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
                    {t('common.loading', 'Loading...')}
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[var(--color-text-secondary)]">
                    {t('exportHistory.empty', 'No export history found.')}
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr key={record.id} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        <span className="text-[var(--color-text-primary)] font-medium">
                          {new Date(record.createdAt).toLocaleString(isRtl ? 'ar-AE' : 'en-US')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {record.format === 'CSV' ? (
                          <FileText className="w-4 h-4 text-blue-500" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-[var(--color-text-primary)] font-bold">{record.format}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-[var(--color-text-primary)] font-medium">
                      {record.recordCount}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {(!record.filters.search && !record.filters.status && !record.filters.tier) ? (
                          <span className="text-[var(--color-text-secondary)] text-xs">{t('exportHistory.noFilters', 'None')}</span>
                        ) : (
                          <>
                            {record.filters.search && (
                              <span className="px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md text-xs font-medium flex items-center gap-1">
                                <Filter className="w-3 h-3" /> {record.filters.search}
                              </span>
                            )}
                            {record.filters.status && (
                              <span className="px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md text-xs font-medium">
                                Status: {record.filters.status}
                              </span>
                            )}
                            {record.filters.tier && (
                              <span className="px-2 py-1 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md text-xs font-medium">
                                Tier: {record.filters.tier}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-end">
                      <a 
                        href={record.fileUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-sm"
                      >
                        <Download className="w-4 h-4" />
                        {t('common.download', 'Download')}
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
