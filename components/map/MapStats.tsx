"use client";

import { useTranslation } from "react-i18next";
import { MapPin, TrendingUp, Users, Target, Zap } from "lucide-react";
import type { MapLead } from "./GeoMap";

interface MapStatsProps {
  leads: MapLead[];
  filteredCount: number;
  geofencedCount: number;
}

export default function MapStats({ leads, filteredCount, geofencedCount }: MapStatsProps) {
  const { t } = useTranslation("common");

  const totalLeads = leads.length;
  const avgScore = totalLeads > 0
    ? Math.round(leads.reduce((s, l) => s + l.score, 0) / totalLeads)
    : 0;
  const t1Count = leads.filter((l) => l.tier === 1).length;
  const topLocations = Object.entries(
    leads.reduce((acc: Record<string, number>, l) => {
      const key = l.location?.split(",")[0]?.trim() || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const stats = [
    {
      icon: Users,
      label: t("map.stats.totalLeads", "Total Leads"),
      value: totalLeads,
      color: "#185FA5",
      bg: "#E6F1FB",
    },
    {
      icon: TrendingUp,
      label: t("map.stats.avgScore", "Avg. Score"),
      value: avgScore,
      color: avgScore >= 90 ? "#1D9E75" : avgScore >= 75 ? "#BA7517" : "#A32D2D",
      bg: avgScore >= 90 ? "#E1F5EE" : avgScore >= 75 ? "#FAEEDA" : "#FAECE7",
    },
    {
      icon: Zap,
      label: t("map.stats.eliteLeads", "Elite (T1)"),
      value: t1Count,
      color: "#3C3489",
      bg: "#EEEDFE",
    },
    {
      icon: Target,
      label: t("map.stats.geofenced", "In Zone"),
      value: geofencedCount,
      color: "#1D9E75",
      bg: "#E1F5EE",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Stat Tiles */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] flex items-center gap-3 transition-all hover:shadow-sm"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: stat.bg }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div className="min-w-0">
              <div
                className="text-xl font-bold leading-none"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hot Zones */}
      {topLocations.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
              {t("map.stats.hotZones", "Hot Zones")}
            </span>
          </div>
          <div className="space-y-2">
            {topLocations.map(([loc, count], idx) => (
              <div key={loc} className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{
                    background: idx === 0 ? "#3C3489" : idx === 1 ? "#085041" : "#444441",
                  }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                      {loc}
                    </span>
                    <span className="text-xs font-bold text-[var(--color-text-secondary)] ms-2">
                      {count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / totalLeads) * 100}%`,
                        background: idx === 0 ? "#3C3489" : idx === 1 ? "#085041" : "#444441",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
