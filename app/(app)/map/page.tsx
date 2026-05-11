"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import {
  MapPin,
  Layers,
  Thermometer,
  Target,
  Filter,
  RefreshCw,
  ChevronDown,
  Info,
  Crosshair,
  X,
  Loader2,
  TrendingUp,
  ZapOff,
} from "lucide-react";
import MapStats from "@/components/map/MapStats";
import MapLeadPanel from "@/components/map/MapLeadPanel";
import type { MapLead } from "@/components/map/GeoMap";

// Dynamically import the map to avoid SSR issues
const GeoMap = dynamic(() => import("@/components/map/GeoMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-surface)] rounded-2xl">
      <div className="flex flex-col items-center gap-3 text-[var(--color-text-secondary)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        <span className="text-sm font-medium">Loading Map...</span>
      </div>
    </div>
  ),
});

type LayerType = "markers" | "heatmap";

export default function MapPage() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";

  const [leads, setLeads] = useState<MapLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<LayerType>("markers");
  const [selectedLead, setSelectedLead] = useState<MapLead | null>(null);
  const [geofenceActive, setGeofenceActive] = useState(false);
  const [geofencedLeads, setGeofencedLeads] = useState<MapLead[]>([]);
  const [geofenceBounds, setGeofenceBounds] = useState<{
    north: number; south: number; east: number; west: number;
  } | null>(null);

  // Filters
  const [tierFilter, setTierFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scoreMin, setScoreMin] = useState<number>(0);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/leads?limit=200";
      if (tierFilter) url += `&tier=${tierFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      const filtered = (data.leads || []).filter(
        (l: MapLead) => l.score >= scoreMin
      );
      setLeads(filtered);
    } catch (e) {
      console.error(e);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [tierFilter, statusFilter, scoreMin]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleGeofenceDrawn = useCallback(
    (bounds: { north: number; south: number; east: number; west: number }) => {
      setGeofenceBounds(bounds);
      setGeofenceActive(false);

      // Approximate: filter leads whose coords fall in bounds
      // We check by location name matching to UAE_AREAS
      const UAE_AREAS: Record<string, { lat: number; lng: number }> = {
        "Dubai Marina": { lat: 25.0807, lng: 55.14 },
        "Palm Jumeirah": { lat: 25.1124, lng: 55.139 },
        "Downtown Dubai": { lat: 25.1972, lng: 55.2744 },
        "Business Bay": { lat: 25.186, lng: 55.265 },
        "Jumeirah": { lat: 25.2048, lng: 55.2455 },
        "DIFC": { lat: 25.2108, lng: 55.282 },
        "JBR": { lat: 25.0786, lng: 55.1341 },
        "Arabian Ranches": { lat: 25.0536, lng: 55.271 },
        "Al Barsha": { lat: 25.1127, lng: 55.1992 },
        "Mirdif": { lat: 25.2218, lng: 55.4224 },
        "Deira": { lat: 25.2697, lng: 55.3095 },
        "Bur Dubai": { lat: 25.2532, lng: 55.2956 },
        "JVC": { lat: 25.0657, lng: 55.2105 },
        "Yas Island": { lat: 24.4672, lng: 54.6031 },
        "Al Reem Island": { lat: 24.4975, lng: 54.4186 },
        "Saadiyat Island": { lat: 24.5404, lng: 54.4416 },
        "Khalidiyah": { lat: 24.4755, lng: 54.3557 },
        "Al Raha Beach": { lat: 24.4293, lng: 54.5697 },
        "Corniche": { lat: 24.4638, lng: 54.3444 },
        "Sharjah City": { lat: 25.3463, lng: 55.4209 },
        "Al Nahda": { lat: 25.3007, lng: 55.4177 },
        "Al Khan": { lat: 25.3531, lng: 55.3795 },
        "Ajman": { lat: 25.4052, lng: 55.5136 },
        "Ras Al Khaimah": { lat: 25.7953, lng: 55.9788 },
        "Fujairah": { lat: 25.1288, lng: 56.3265 },
      };

      const inside = leads.filter((lead) => {
        let coords = { lat: 25.2 + Math.random() * 0.5, lng: 55.2 + Math.random() * 0.5 };
        for (const [key, val] of Object.entries(UAE_AREAS)) {
          if (lead.location?.toLowerCase().includes(key.toLowerCase())) {
            coords = val;
            break;
          }
        }
        return (
          coords.lat <= bounds.north &&
          coords.lat >= bounds.south &&
          coords.lng <= bounds.east &&
          coords.lng >= bounds.west
        );
      });

      setGeofencedLeads(inside);
    },
    [leads]
  );

  const clearGeofence = () => {
    setGeofenceBounds(null);
    setGeofencedLeads([]);
  };

  const layers: { id: LayerType; label: string; icon: any; desc: string }[] = [
    {
      id: "markers",
      label: t("map.layer.markers", "Lead Clusters"),
      icon: MapPin,
      desc: t("map.layer.markersDesc", "See all leads plotted by location"),
    },
    {
      id: "heatmap",
      label: t("map.layer.heatmap", "Demand Heatmap"),
      icon: Thermometer,
      desc: t("map.layer.heatmapDesc", "Visualize demand intensity across UAE"),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("map.title", "Geo-Intelligence Map")}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-0.5">
            {t("map.subtitle", "Visualize lead clusters and demand signals across the UAE.")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Layer Switcher */}
          <div className="flex bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-border)]">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                title={layer.desc}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeLayer === layer.id
                    ? "bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <layer.icon className="w-3.5 h-3.5" />
                {layer.label}
              </button>
            ))}
          </div>

          {/* Geofence button */}
          <button
            onClick={() => {
              clearGeofence();
              setGeofenceActive((v) => !v);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              geofenceActive
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-blue-500/20"
                : "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]"
            }`}
          >
            <Crosshair className="w-4 h-4" />
            {geofenceActive
              ? t("map.drawing", "Drawing Zone...")
              : t("map.drawZone", "Draw Zone")}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-surface)] transition-all"
          >
            <RefreshCw
              className={`w-4 h-4 text-[var(--color-text-secondary)] ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex flex-wrap gap-4 items-center shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-secondary)]">
          <Filter className="w-4 h-4" />
          {t("leads.filters", "Filters")}
        </div>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value ? Number(e.target.value) : "")}
          className="px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
        >
          <option value="">{t("leads.tiers.all", "All Tiers")}</option>
          <option value="1">{t("leads.tiers.t1", "T1 — Elite")}</option>
          <option value="2">{t("leads.tiers.t2", "T2 — Premium")}</option>
          <option value="3">{t("leads.tiers.t3", "T3 — Standard")}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
        >
          <option value="">{t("leads.status.all", "All Statuses")}</option>
          <option value="new">{t("leads.status.new", "New")}</option>
          <option value="contacted">{t("leads.status.contacted", "Contacted")}</option>
          <option value="qualified">{t("leads.status.qualified", "Qualified")}</option>
          <option value="proposal">{t("leads.status.proposal", "Proposal")}</option>
          <option value="closed">{t("leads.status.closed", "Closed")}</option>
        </select>

        {/* Min Score */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium whitespace-nowrap">
            {t("map.filter.minScore", "Min Score")}: {scoreMin}
          </span>
          <input
            type="range"
            min={0}
            max={95}
            step={5}
            value={scoreMin}
            onChange={(e) => setScoreMin(Number(e.target.value))}
            className="w-24 accent-[#185FA5]"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] ms-auto">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t("map.loading", "Loading leads...")}
          </div>
        )}
      </div>

      {/* Geofence Instruction Banner */}
      {geofenceActive && (
        <div className="flex items-center gap-3 p-3 bg-[#E6F1FB] border border-[#185FA5]/30 rounded-xl">
          <Info className="w-4 h-4 text-[#185FA5] flex-shrink-0" />
          <span className="text-sm text-[#185FA5] font-medium">
            {t("map.geofenceHint", "Click and drag on the map to draw a geo-fence zone. Release to see leads within the zone.")}
          </span>
          <button
            onClick={() => setGeofenceActive(false)}
            className="ms-auto p-1 rounded-lg hover:bg-[#185FA5]/10 transition-colors"
          >
            <X className="w-4 h-4 text-[#185FA5]" />
          </button>
        </div>
      )}

      {/* Geofence result banner */}
      {geofenceBounds && !geofenceActive && (
        <div className="flex items-center gap-3 p-3 bg-[#E1F5EE] border border-[#1D9E75]/30 rounded-xl">
          <Target className="w-4 h-4 text-[#1D9E75] flex-shrink-0" />
          <span className="text-sm text-[#1D9E75] font-medium">
            {t("map.geofenceResult", "{{count}} leads found in your geo-fence zone.", {
              count: geofencedLeads.length,
            })}
          </span>
          <button
            onClick={clearGeofence}
            className="ms-auto flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1D9E75]/10 hover:bg-[#1D9E75]/20 text-[#1D9E75] text-xs font-bold transition-colors"
          >
            <X className="w-3 h-3" />
            {t("map.clearZone", "Clear Zone")}
          </button>
        </div>
      )}

      {/* Main Content: Map + Sidebar */}
      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Map container */}
        <div className="flex-1 relative" style={{ minHeight: 560 }}>
          {/* Geofence drawing hint overlay */}
          {geofenceActive && (
            <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl border-2 border-dashed border-[var(--color-primary)] animate-pulse" />
          )}

          <GeoMap
            leads={leads}
            language={i18n.language}
            activeLayer={activeLayer}
            onSelectLead={(lead) => setSelectedLead(lead)}
            geofenceActive={geofenceActive}
            onGeofenceDrawn={handleGeofenceDrawn}
          />

          {/* Floating Lead Panel */}
          {selectedLead && (
            <MapLeadPanel
              lead={selectedLead}
              onClose={() => setSelectedLead(null)}
            />
          )}

          {/* Layer indicator badge */}
          <div className="absolute top-4 inset-inline-end-4 z-[900] flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-bold">
            {activeLayer === "markers" ? (
              <MapPin className="w-3.5 h-3.5" />
            ) : (
              <Thermometer className="w-3.5 h-3.5" />
            )}
            {layers.find((l) => l.id === activeLayer)?.label}
          </div>
        </div>

        {/* Stats Sidebar */}
        <div className="lg:w-72 xl:w-80 space-y-4">
          <MapStats
            leads={leads}
            filteredCount={leads.length}
            geofencedCount={geofencedLeads.length}
          />

          {/* Geofenced Leads List */}
          {geofencedLeads.length > 0 && (
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#1D9E75]" />
                  <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                    {t("map.zone.leads", "Zone Leads")} ({geofencedLeads.length})
                  </span>
                </div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {geofencedLeads.map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="w-full text-start p-2.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-primary-subtle)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{
                          background:
                            lead.score >= 90
                              ? "#1D9E75"
                              : lead.score >= 75
                              ? "#BA7517"
                              : "#A32D2D",
                        }}
                      >
                        {lead.score}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                          {i18n.language === "ar" && lead.nameAr ? lead.nameAr : lead.name}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] truncate">
                          {lead.company}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feature Legend */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <div className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">
              {t("map.legend.title", "Legend")}
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#3C3489] flex-shrink-0" />
                {t("leads.tiers.t1", "T1 — Elite")}
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#085041] flex-shrink-0" />
                {t("leads.tiers.t2", "T2 — Premium")}
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#444441] flex-shrink-0" />
                {t("leads.tiers.t3", "T3 — Standard")}
              </div>
              <div className="border-t border-[var(--color-border)] my-2" />
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#1D9E75] flex-shrink-0" />
                {t("map.legend.score90", "Score ≥ 90")}
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#BA7517] flex-shrink-0" />
                {t("map.legend.score75", "Score 75–89")}
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                <span className="w-3 h-3 rounded-full bg-[#A32D2D] flex-shrink-0" />
                {t("map.legend.scoreLow", "Score < 75")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
