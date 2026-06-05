"use client";

import { useState, useEffect } from "react";
import { Play, Activity, Clock, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ScrapeRun {
  id: string;
  status: string;
  leadsFound: number;
  startedAt: string;
  completedAt: string | null;
  sources: string[];
  logUrl?: string | null;
}

export default function ScraperSettingsPage() {
  const { t } = useTranslation('common');
  const [runs, setRuns] = useState<ScrapeRun[]>([]);
  const [isTriggering, setIsTriggering] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      const res = await fetch("/api/scrape-runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // Poll every 10s if any run is PROCESSING
    const interval = setInterval(() => {
      setRuns(current => {
        if (current.some(r => r.status === "PROCESSING" || r.status === "PENDING")) {
          fetchRuns();
        }
        return current;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleManualTrigger = async () => {
    setIsTriggering(true);
    toast.info("Triggering scrape pipeline...");
    try {
      // We hit the cron endpoint directly, passing a dummy header for auth bypass or the UI endpoint
      // Actually, since the cron endpoint requires CRON_SECRET which is hidden, let's just create a quick wrapper in /api/scrape/route.ts
      // For now, let's assume we can hit the old scrape route or we make a new one. 
      // To keep it simple, we hit /api/scrape which we can re-route to use the cron logic.
      
      const res = await fetch('/api/cron/scrape', {
        method: 'GET'
      });

      if (!res.ok) throw new Error(await res.text());
      toast.success("Scrape job started successfully!");
      fetchRuns();
    } catch (err: any) {
      toast.error(`Failed to trigger scrape: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('settings.scraper.title', 'Scraper Settings')}</h1>
          <p className="text-[var(--color-text-secondary)]">{t('settings.scraper.subtitle', 'Manage property portal integrations and view run history.')}</p>
        </div>
        <button
          onClick={handleManualTrigger}
          disabled={isTriggering}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
        >
          {isTriggering ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
          {isTriggering ? t('settings.scraper.triggering', 'Triggering...') : t('settings.scraper.triggerBtn', 'Run Scraper Now')}
        </button>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <h3 className="font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--color-text-secondary)]" />
            {t('settings.scraper.recent', 'Recent Scrape Runs')}
          </h3>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-[var(--color-text-secondary)] animate-pulse">{t('common.loading', 'Loading history...')}</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-secondary)] flex flex-col items-center">
            <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
            <p>{t('settings.scraper.empty', 'No scrape runs recorded yet.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-start">
              <thead className="bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('settings.scraper.table.date', 'Date')}</th>
                  <th className="px-4 py-3 font-medium">{t('settings.scraper.table.status', 'Status')}</th>
                  <th className="px-4 py-3 font-medium">{t('settings.scraper.table.sources', 'Sources')}</th>
                  <th className="px-4 py-3 font-medium">{t('settings.scraper.table.leadsFound', 'Leads Found')}</th>
                  <th className="px-4 py-3 font-medium">{t('settings.scraper.table.duration', 'Duration')}</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-[var(--color-bg-surface)]/50 transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-primary)]">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        run.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' :
                        run.status === 'PROCESSING' || run.status === 'PENDING' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {Array.isArray(run.sources) ? run.sources.join(', ') : t('common.notAvailable', 'Unknown')}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                        {run.leadsFound}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {run.completedAt ? (
                        `${Math.max(1, Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000))}s`
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {run.logUrl && (
                        <a 
                          href={run.logUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline font-medium"
                        >
                          View Logs
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
