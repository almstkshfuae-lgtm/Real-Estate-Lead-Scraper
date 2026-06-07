"use client";

import { useTranslation } from "react-i18next";
import { X, Phone, Mail, MapPin, Star, TrendingUp, Building2 } from "lucide-react";
import type { MapLead } from "./GeoMap";

interface MapLeadPanelProps {
  lead: MapLead | null;
  onClose: () => void;
  onAction: (lead: MapLead) => void;
}

const SIGNAL_STYLES: Record<string, { bg: string; text: string }> = {
  uhnw: { bg: "#FAEEDA", text: "#633806" },
  "high net worth": { bg: "#EEEDFE", text: "#3C3489" },
  investor: { bg: "#E1F5EE", text: "#085041" },
  "private client": { bg: "#E6F1FB", text: "#0C447C" },
  "business owner": { bg: "#FAECE7", text: "#712B13" },
  executive: { bg: "#FBEAF0", text: "#72243E" },
};

function getSignalStyle(signal: string) {
  return (
    SIGNAL_STYLES[signal.toLowerCase()] || {
      bg: "#F0F2F5",
      text: "#374151",
    }
  );
}

function getScoreColor(score: number) {
  if (score >= 90) return "#1D9E75";
  if (score >= 75) return "#BA7517";
  return "#A32D2D";
}

function getTierLabel(tier: number, language: string) {
  if (language === "ar") {
    return tier === 1 ? "الفئة 1 — نخبة" : tier === 2 ? "الفئة 2 — مميز" : "الفئة 3 — قياسي";
  }
  return tier === 1 ? "T1 — Elite" : tier === 2 ? "T2 — Premium" : "T3 — Standard";
}

function getTierColor(tier: number): string {
  if (tier === 1) return "#3C3489";
  if (tier === 2) return "#085041";
  return "#444441";
}

export default function MapLeadPanel({ lead, onClose, onAction }: MapLeadPanelProps) {
  const { t, i18n } = useTranslation("common");
  const language = i18n.language;
  const isRtl = language === "ar";

  if (!lead) return null;

  const displayName = (language === "ar" && lead.nameAr) ? lead.nameAr : lead.name;
  const signals = (Array.isArray(lead.signals) ? lead.signals : []).filter(s => s !== "Manual Import");
  const scoreColor = getScoreColor(lead.score);
  const tierColor = getTierColor(lead.tier);

  return (
    <div
      className="absolute bottom-4 inset-inline-start-4 z-[1000] w-80 bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden"
      style={{ backdropFilter: "blur(16px)" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-start justify-between gap-3"
        style={{ background: `linear-gradient(135deg, ${tierColor}15, ${tierColor}08)`, borderBottom: `1px solid ${tierColor}22` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Score Circle */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 shadow-lg"
            style={{ background: scoreColor, boxShadow: `0 4px 12px ${scoreColor}44` }}
          >
            {lead.score}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[var(--color-text-primary)] truncate">{displayName}</div>
            <div className="text-xs text-[var(--color-text-secondary)] truncate">{lead.company}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-surface)] transition-colors flex-shrink-0 mt-0.5"
        >
          <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Location */}
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <MapPin className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
          <span className="truncate">{lead.location}</span>
        </div>

        {/* Tier + Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: `${tierColor}20`, color: tierColor }}
          >
            {getTierLabel(lead.tier, language)}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] capitalize">
            {lead.status}
          </span>
        </div>

        {/* Budget */}
        {(lead.budgetMin || lead.budgetMax) && (
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" />
            <span className="font-medium text-[var(--color-text-primary)]">
              {lead.budgetMin
                ? `AED ${(lead.budgetMin / 1_000_000).toFixed(1)}M`
                : ""}
              {lead.budgetMin && lead.budgetMax ? " – " : ""}
              {lead.budgetMax
                ? `AED ${(lead.budgetMax / 1_000_000).toFixed(1)}M`
                : ""}
            </span>
          </div>
        )}

        {/* Signals */}
        {signals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {signals.map((sig: string) => {
              const style = getSignalStyle(sig);
              return (
                <span
                  key={sig}
                  className="px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: style.bg, color: style.text }}
                >
                  {sig}
                </span>
              );
            })}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => onAction(lead)}
          className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-md shadow-blue-500/10"
        >
          <Star className="w-3.5 h-3.5" />
          {t("map.viewDetails", "View Full Profile")}
        </button>
      </div>
    </div>
  );
}
