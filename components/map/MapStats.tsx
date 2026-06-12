import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, TrendingUp, Users, Target, Zap } from "lucide-react";
import type { MapLead } from "./GeoMap";
import { AREA_TRANSLATIONS } from "@/lib/areas";

interface MapStatsProps {
  leads: MapLead[];
  filteredCount: number;
  geofencedCount: number;
  projects?: any[];
}

export default function MapStats({ leads, filteredCount, geofencedCount, projects = [] }: MapStatsProps) {
  const { t, i18n } = useTranslation("common");
  const language = i18n.language;
  const isAr = language === "ar";

  const { avgScore, t1Count, topLocations, stats } = useMemo(() => {
    const totalLeads = leads.length;
    const avg = totalLeads > 0
      ? Math.round(leads.reduce((s, l) => s + l.score, 0) / totalLeads)
      : 0;
    
    const t1 = leads.filter((l) => l.tier === 1).length;
    
    const normalizeClientLocation = (loc: string): string => {
      const normalized = (loc || "").trim();
      if (!normalized) return "Abu Dhabi";
      const lower = normalized.toLowerCase();
      if (lower.includes("ياس") || lower.includes("yas")) return "Yas Island";
      if (lower.includes("ريم") || lower.includes("reem")) return "Al Reem Island";
      if (lower.includes("سعديات") || lower.includes("saadiyat")) return "Saadiyat Island";
      if (lower.includes("خالدية") || lower.includes("khalidiyah") || lower.includes("khalidiya")) return "Khalidiyah";
      if (lower.includes("راحه") || lower.includes("raha")) return "Al Raha Beach";
      if (lower.includes("كورنيش") || lower.includes("corniche")) return "Corniche";
      if (lower.includes("مارينا") || lower.includes("marina")) return "Dubai Marina";
      if (lower.includes("نخلة") || lower.includes("palm")) return "Palm Jumeirah";
      if (lower.includes("وسط المدينة") || lower.includes("downtown")) return "Downtown Dubai";
      if (lower.includes("خليج الأعمال") || lower.includes("business bay")) return "Business Bay";
      if (lower.includes("جميرا") || lower.includes("jumeirah")) return "Jumeirah";
      if (lower.includes("العالمي") || lower.includes("difc")) return "DIFC";
      if (lower.includes("ممشى جي بي آر") || lower.includes("jbr")) return "JBR";
      if (lower.includes("المرابع") || lower.includes("ranches")) return "Arabian Ranches";
      if (lower.includes("البرشاء") || lower.includes("barsha")) return "Al Barsha";
      if (lower.includes("مردف") || lower.includes("mirdif")) return "Mirdif";
      if (lower.includes("ديرة") || lower.includes("deira")) return "Deira";
      if (lower.includes("بر دبي") || lower.includes("bur dubai")) return "Bur Dubai";
      if (lower.includes("قرية جميرا") || lower.includes("jvc")) return "JVC";
      if (lower.includes("شارقة") || lower.includes("sharjah")) return "Sharjah City";
      if (lower.includes("نهدة") || lower.includes("nahda")) return "Al Nahda";
      if (lower.includes("خان") || lower.includes("khan")) return "Al Khan";
      if (lower.includes("عجمان") || lower.includes("ajman")) return "Ajman";
      if (lower.includes("خيمة") || lower.includes("khaimah") || lower.includes("rak")) return "Ras Al Khaimah";
      if (lower.includes("فجيرة") || lower.includes("fujairah")) return "Fujairah";
      if (lower.includes("دبي") || lower.includes("dubai")) return "Dubai";
      if (lower.includes("أبوظبي") || lower.includes("abu dhabi") || lower.includes("abu_dhabi")) return "Abu Dhabi";
      if (lower.includes("أم القيوين") || lower.includes("quwain") || lower.includes("uaq")) return "Umm Al Quwain";
      return normalized;
    };

    const locations = Object.entries(
      leads.reduce((acc: Record<string, number>, l) => {
        const key = normalizeClientLocation(l.location?.split(",")[0]?.trim() || "Unknown");
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    const statsList = [
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
        value: avg,
        color: avg >= 90 ? "#1D9E75" : avg >= 75 ? "#BA7517" : "#A32D2D",
        bg: avg >= 90 ? "#E1F5EE" : avg >= 75 ? "#FAEEDA" : "#FAECE7",
      },
      {
        icon: Zap,
        label: t("map.stats.eliteLeads", "Elite (T1)"),
        value: t1,
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

    return { avgScore: avg, t1Count: t1, topLocations: locations, stats: statsList };
  }, [leads, geofencedCount, t]);

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

      {/* Projects summary if available */}
      {projects && projects.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#085041]" />
            <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
              {t("map.stats.projects", "Off-Plan Projects")}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-[var(--color-bg-surface)] rounded-lg">
              <div className="text-[var(--color-text-secondary)] font-medium">{t("map.stats.projectsCount", "Projects")}</div>
              <div className="text-lg font-extrabold text-[var(--color-text-primary)] mt-0.5">{projects.length}</div>
            </div>
            <div className="p-2.5 bg-[var(--color-bg-surface)] rounded-lg">
              <div className="text-[var(--color-text-secondary)] font-medium">{t("map.stats.avgStartPrice", "Avg Start Price")}</div>
              <div className="text-sm font-extrabold text-[#085041] mt-1 truncate">
                {(() => {
                  const validPrices = projects.map(p => p.startingPrice).filter(price => typeof price === "number" && price > 0);
                  if (validPrices.length === 0) return t("common.notAvailable", "N/A");
                  const avgPrice = Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length);
                  const mVal = (avgPrice / 1000000).toFixed(1);
                  return isAr ? `${mVal} مليون د.إ` : `${mVal}M AED`;
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {topLocations.map(([loc, count], idx) => {
              const displayLoc = isAr ? (AREA_TRANSLATIONS[loc] || loc) : loc;
              return (
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
                        {displayLoc}
                      </span>
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] ms-2">
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-bg-surface)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(count / leads.length) * 100}%`,
                          background: idx === 0 ? "#3C3489" : idx === 1 ? "#085041" : "#444441",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
