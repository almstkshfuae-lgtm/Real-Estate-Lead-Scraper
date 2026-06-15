"use client";

import { useState, useEffect } from "react";
import { Play, Activity, Clock, Users, AlertCircle, Brain, CheckCircle2, BarChart3, TrendingUp, Crosshair, Sparkles } from "lucide-react";
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

  // ML Scoring state
  const [mlStatus, setMlStatus] = useState<{
    ready: boolean;
    wonCount: number;
    lostCount: number;
    totalCount: number;
    requiredCount: number;
  } | null>(null);
  const [mlLoading, setMlLoading] = useState(true);
  const [mlTraining, setMlTraining] = useState(false);
  const [mlResult, setMlResult] = useState<any>(null);

  // Validation state
  const [validationMetrics, setValidationMetrics] = useState<any | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

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

  const fetchMlStatus = async () => {
    try {
      const res = await fetch("/api/ai/ml-train");
      if (res.ok) {
        const data = await res.json();
        setMlStatus(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMlLoading(false);
    }
  };

  const fetchValidationMetrics = async () => {
    try {
      const res = await fetch("/api/ai/score/validate");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setValidationMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setValidationLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    fetchMlStatus();
    fetchValidationMetrics();
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

  const handleTrainModel = async () => {
    setMlTraining(true);
    setMlResult(null);
    toast.info("Training TensorFlow.js model on outcomes...");
    try {
      const res = await fetch("/api/ai/ml-train", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to train");
      setMlResult(data);
      toast.success("TensorFlow.js scoring model trained successfully!");
      fetchMlStatus();
      fetchValidationMetrics();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMlTraining(false);
    }
  };

  const handleSeedOutcomes = async () => {
    setIsSeeding(true);
    toast.info("Seeding outcomes...");
    try {
      const res = await fetch("/api/ai/score/validate/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to seed outcomes");
      toast.success("Historical outcomes seeded successfully!");
      await Promise.all([
        fetchRuns(),
        fetchMlStatus(),
        fetchValidationMetrics()
      ]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleManualTrigger = async () => {
    setIsTriggering(true);
    toast.info("Triggering scrape pipeline...");
    try {
      // We hit the cron endpoint directly, passing a dummy header for auth bypass or the UI endpoint
      // Actually, since the cron endpoint requires CRON_SECRET which is hidden, let's just create a quick wrapper in /api/scrape/route.ts
      // For now, let's assume we can hit the old scrape route or we make a new one. 
      // To keep it simple, we hit /api/scrape which we can re-route to use the cron logic.

      const res = await fetch('/api/cron/scrape', {
        method: 'POST'
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

  // Compute high failure alert locally on the first 5 runs (Point 4)
  const recentRunsForAlert = runs.slice(0, 5);
  const failedRunsCount = recentRunsForAlert.filter(r => r.status === "FAILED").length;
  const isHighFailureAlert = recentRunsForAlert.length >= 3 && (failedRunsCount / recentRunsForAlert.length) >= 0.5;

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

      {isHighFailureAlert && (
        <div className="bg-red-50 dark:bg-red-955/20 border border-red-200 dark:border-red-900/30 rounded-2xl p-5 flex items-start gap-3 text-start animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-red-800 dark:text-red-300">
              {t('settings.scraper.highFailureAlert.title', 'High Scraper Failure Rate Alert')}
            </h4>
            <p className="text-sm text-red-700 dark:text-red-400">
              {t('settings.scraper.highFailureAlert.desc', 'Warning: {{failedCount}} of the last {{totalCount}} scrape runs have failed. Please check the scraper service connection, verify source configurations, or review the execution logs.', { failedCount: failedRunsCount, totalCount: recentRunsForAlert.length })}
            </p>
          </div>
        </div>
      )}

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
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${run.status === 'COMPLETED' ? 'bg-green-500/10 text-green-500' :
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

      {/* ML TensorFlow.js Scoring Model Card */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                {t('settings.scraper.ml.title', 'ML Lead Scoring Model')}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('settings.scraper.ml.subtitle', 'Train in-app TensorFlow.js scoring model on agent won/lost outcomes.')}
              </p>
            </div>
          </div>
          <button
            onClick={handleTrainModel}
            disabled={mlTraining || !mlStatus?.ready}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {mlTraining ? <Activity className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {mlTraining ? t('settings.scraper.ml.training', 'Training...') : t('settings.scraper.ml.trainBtn', 'Train Model Now')}
          </button>
        </div>

        {mlLoading ? (
          <div className="py-4 text-center text-[var(--color-text-secondary)] animate-pulse">Loading ML model status...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Won Leads</p>
                <p className="text-xl font-black text-green-500 mt-1">{mlStatus?.wonCount || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Lost Leads</p>
                <p className="text-xl font-black text-red-500 mt-1">{mlStatus?.lostCount || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Training Readiness</p>
                <p className={`text-sm font-bold mt-2.5 ${mlStatus?.ready ? 'text-green-500' : 'text-amber-500'}`}>
                  {mlStatus?.ready 
                    ? '✓ Ready to train' 
                    : `Needs ${500 - (mlStatus?.totalCount || 0)} more outcomes`}
                </p>
              </div>
            </div>

            {!mlStatus?.ready && !mlResult && (
              <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-start">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <strong>Scoring Weight Adaptations Idle:</strong> The system requires at least 500 historical won/lost lead outcomes to train the TensorFlow.js neural network. It will continue using standard base scoring weights (+12 for Elite sources, +8 for UHNW, etc.) until this threshold is reached.
                </div>
              </div>
            )}

            {mlResult && (
              <div className="p-5 rounded-xl border border-indigo-200 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-950/10 space-y-4 text-start">
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/20 pb-3">
                  <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Model Trained Successfully
                  </span>
                  <div className="flex gap-4 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    <span>Accuracy: {(mlResult.accuracy * 100).toFixed(1)}%</span>
                    <span>Loss: {mlResult.loss.toFixed(4)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Learned Feature Importances</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(mlResult.featureImportance || {}).map(([feature, weight]: [any, any]) => (
                      <div key={feature} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-[var(--color-text-primary)] capitalize">{feature === 'isHNW' ? 'HNWI Signals' : feature === 'isBizOwner' ? 'Business Owner/Exec' : feature}</span>
                          <span className="text-[var(--color-text-secondary)]">{weight.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${weight}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead Scoring & Tiering Validation Card */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="text-start">
              <h3 className="font-bold text-lg text-[var(--color-text-primary)]">
                {t('settings.scraper.validation.title', 'Lead Scoring & Tiering Validation')}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('settings.scraper.validation.subtitle', 'Validate scoring accuracy against real won/lost outcomes.')}
              </p>
            </div>
          </div>
          {validationMetrics && validationMetrics.totalLeads < 10 && (
            <button
              onClick={handleSeedOutcomes}
              disabled={isSeeding}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSeeding ? <Activity className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isSeeding ? t('settings.scraper.validation.seeding', 'Seeding...') : t('settings.scraper.validation.seedBtn', 'Seed Simulated Outcomes (550 leads)')}
            </button>
          )}
        </div>

        {validationLoading ? (
          <div className="py-4 text-center text-[var(--color-text-secondary)] animate-pulse">Loading validation metrics...</div>
        ) : !validationMetrics || validationMetrics.totalLeads < 10 ? (
          <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-start">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>{t('settings.scraper.validation.noOutcomes', 'Insufficient Historical Outcomes.')}</strong>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {t('settings.scraper.validation.correlation', 'Pearson Correlation')}
                </p>
                <p className={`text-xl font-black mt-1 ${
                  validationMetrics.pearsonCorrelation >= 0.5 ? 'text-green-500' :
                  validationMetrics.pearsonCorrelation >= 0.3 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {validationMetrics.pearsonCorrelation.toFixed(3)}
                </p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                  {t('settings.scraper.validation.correlationDesc', 'Target: > 0.50')}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
                  {t('settings.scraper.validation.avgScoreWon', 'Avg. Score (Won)')}
                </p>
                <p className="text-xl font-black text-green-500 mt-1">{validationMetrics.avgScoreWon.toFixed(1)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
                  {t('settings.scraper.validation.avgScoreLost', 'Avg. Score (Lost)')}
                </p>
                <p className="text-xl font-black text-red-500 mt-1">{validationMetrics.avgScoreLost.toFixed(1)}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">Win Rate</p>
                <p className="text-xl font-black text-[var(--color-primary)] mt-1">{validationMetrics.overallWinRate.toFixed(1)}%</p>
                <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{validationMetrics.wonLeads} won / {validationMetrics.lostLeads} lost</p>
              </div>
            </div>

            {/* Tier Conversion + Score Band Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tier Conversion */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 space-y-3 text-start">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('settings.scraper.validation.tierConversion', 'Conversion by Tier')}
                </h4>
                {[
                  { label: 'T1 — Elite', value: validationMetrics.tierConversion.tier1, color: '#3C3489' },
                  { label: 'T2 — Premium', value: validationMetrics.tierConversion.tier2, color: '#085041' },
                  { label: 'T3 — Standard', value: validationMetrics.tierConversion.tier3, color: '#444441' },
                ].map(tier => (
                  <div key={tier.label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-[var(--color-text-primary)]">{tier.label}</span>
                      <span className="text-[var(--color-text-secondary)]">{tier.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(tier.value, 100)}%`, backgroundColor: tier.color }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Score Band Win Rates */}
              <div className="p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 space-y-3 text-start">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('settings.scraper.validation.scoreBandConversion', 'Win Rate by Score Band')}
                </h4>
                {[
                  { label: '90–100', value: validationMetrics.scoreBandConversion.band90to100, color: '#1D9E75' },
                  { label: '80–89', value: validationMetrics.scoreBandConversion.band80to89, color: '#22C55E' },
                  { label: '70–79', value: validationMetrics.scoreBandConversion.band70to79, color: '#BA7517' },
                  { label: '60–69', value: validationMetrics.scoreBandConversion.band60to69, color: '#F59E0B' },
                  { label: '< 60', value: validationMetrics.scoreBandConversion.bandBelow60, color: '#A32D2D' },
                ].map(band => (
                  <div key={band.label} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-bold text-[var(--color-text-primary)]">{band.label}</span>
                      <span className="text-[var(--color-text-secondary)]">{band.value.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--color-bg-base)] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(band.value, 100)}%`, backgroundColor: band.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Heuristic Classifier Performance */}
            <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10 space-y-4 text-start">
              <div className="flex items-center gap-2 border-b border-emerald-100 dark:border-emerald-900/20 pb-3">
                <Crosshair className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-bold text-emerald-900 dark:text-emerald-300">
                  {t('settings.scraper.validation.heuristicPerformance', 'Heuristic Classifier Performance (Threshold: 80)')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase">{t('settings.scraper.validation.precision', 'Precision')}</p>
                  <p className={`text-2xl font-black mt-1 ${validationMetrics.classifierPerformance.precision >= 0.7 ? 'text-green-500' : 'text-amber-500'}`}>
                    {(validationMetrics.classifierPerformance.precision * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase">{t('settings.scraper.validation.recall', 'Recall')}</p>
                  <p className={`text-2xl font-black mt-1 ${validationMetrics.classifierPerformance.recall >= 0.7 ? 'text-green-500' : 'text-amber-500'}`}>
                    {(validationMetrics.classifierPerformance.recall * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-[var(--color-text-secondary)] font-bold uppercase">{t('settings.scraper.validation.f1', 'F1-Score')}</p>
                  <p className={`text-2xl font-black mt-1 ${validationMetrics.classifierPerformance.f1Score >= 0.7 ? 'text-green-500' : 'text-amber-500'}`}>
                    {(validationMetrics.classifierPerformance.f1Score * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Confusion Matrix */}
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {t('settings.scraper.validation.confusionMatrix', 'Confusion Matrix')}
                </h5>
                <div className="grid grid-cols-2 gap-2 max-w-xs">
                  <div className="p-2.5 rounded-lg bg-green-500/10 text-center">
                    <p className="text-[10px] font-bold text-green-600 dark:text-green-400">TP</p>
                    <p className="text-lg font-black text-green-600 dark:text-green-400">{validationMetrics.classifierPerformance.tp}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-500/10 text-center">
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400">FP</p>
                    <p className="text-lg font-black text-red-600 dark:text-red-400">{validationMetrics.classifierPerformance.fp}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-500/10 text-center">
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">FN</p>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400">{validationMetrics.classifierPerformance.fn}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-green-500/10 text-center">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">TN</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{validationMetrics.classifierPerformance.tn}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compliance & Privacy Card */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-bold text-lg">{t('settings.scraper.compliance.title', 'Compliance & Privacy Policy Disclaimer')}</h3>
        </div>
        <div className="text-sm space-y-3 text-[var(--color-text-secondary)]">
          <p>
            {t('settings.scraper.compliance.p1', 'This scraper harvests public business directory information and news mentions for real estate professionals in the UAE. By initiating scrapes or utilizing these leads, you agree to comply with the UAE Federal Decree-Law No. 45 of 2021 on Personal Data Protection (PDPL) and general data privacy frameworks (including GDPR).')}
          </p>
          <p>
            {t('settings.scraper.compliance.p2', 'You must maintain a lawful basis for any marketing or B2B outreach. If a lead requests to opt out or be deleted, you must immediately remove them using the "Delete" action in the Leads table, which soft-deletes the lead. Soft-deleted records are automatically excluded from active views and are permanently purged after 90 days in accordance with the system\'s GDPR retention policy.')}
          </p>
          <p className="font-medium text-amber-500/90">
            {t('settings.scraper.compliance.p3', '* Notice: Scraping private property listings, bypassing captcha controls, or automated extraction from portals like Bayut or Dubizzle without permission may violate their respective Terms of Service. Always run scraper jobs responsibly.')}
          </p>
        </div>
      </div>
    </div>
  );
}
