"use client";

import { useTranslation } from "react-i18next";

export default function ScoreBadge({ score }: { score: number }) {
  let colorClass = "text-[var(--color-danger)] bg-red-50 border-red-100";
  
  if (score >= 90) {
    colorClass = "text-[var(--color-success)] bg-green-50 border-green-100";
  } else if (score >= 75) {
    colorClass = "text-[var(--color-warning)] bg-orange-50 border-orange-100";
  }

  return (
    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full border-2 font-bold text-sm ${colorClass}`}>
      {score}
    </div>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  const { t } = useTranslation('common');
  
  const tiers: Record<number, { label: string, class: string }> = {
    1: { label: t('leads.tiers.t1', 'T1 — Elite'), class: "bg-purple-100 text-purple-700 border-purple-200" },
    2: { label: t('leads.tiers.t2', 'T2 — Premium'), class: "bg-blue-100 text-blue-700 border-blue-200" },
    3: { label: t('leads.tiers.t3', 'T3 — Standard'), class: "bg-gray-100 text-gray-700 border-gray-200" },
  };

  const config = tiers[tier] || tiers[3];

  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.class}`}>
      {config.label}
    </span>
  );
}

export function SignalChip({ signal }: { signal: string }) {
  const { t } = useTranslation('common');
  const signalKey = signal.toLowerCase().replace(/\s+/g, '');
  const translated = t(`leads.signals.${signalKey}`, signal);

  return (
    <span className="px-2 py-0.5 bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] rounded-md text-[10px] font-bold border border-[var(--color-border)] uppercase tracking-tight">
      {translated}
    </span>
  );
}
