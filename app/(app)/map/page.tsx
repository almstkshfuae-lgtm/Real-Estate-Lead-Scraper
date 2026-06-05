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
  AlertCircle
} from "lucide-react";
import { useScrapeRunStatus } from "@/hooks/useScrapeRunStatus";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import MapStats from "@/components/map/MapStats";
import MapLeadPanel from "@/components/map/MapLeadPanel";
import LeadSidebar from "@/components/leads/LeadSidebar";
import type { Lead } from "@/components/leads/LeadTable";
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
  const [sidebarLead, setSidebarLead] = useState<Lead | null>(null);
  const [geofenceActive, setGeofenceActive] = useState(false);
  const [geofencedLeads, setGeofencedLeads] = useState<MapLead[]>([]);
  const [geofenceBounds, setGeofenceBounds] = useState<{
    north: number; south: number; east: number; west: number;
  } | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { status: runStatus, leadsFound, isPolling } = useScrapeRunStatus(activeRunId);

  // Filters
  const [tierFilter, setTierFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scoreMin, setScoreMin] = useState<number>(0);
  const [debouncedScoreMin, setDebouncedScoreMin] = useState<number>(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedScoreMin(scoreMin);
    }, 300);
    return () => clearTimeout(handler);
  }, [scoreMin]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/leads?limit=200&minimal=true&scoreMin=${debouncedScoreMin}`;
      if (tierFilter) url += `&tier=${tierFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await safeJson(res);
      setLeads(data.leads || []);
    } catch (e) {
      console.error(e);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [tierFilter, statusFilter, debouncedScoreMin]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleGeofenceDrawn = useCallback(
    async (bounds: { north: number; south: number; east: number; west: number }) => {
      setGeofenceBounds(bounds);
      setGeofenceActive(false);
      setLoading(true);

      try {
        let url = `/api/leads?limit=200&minimal=true&north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`;
        if (tierFilter) url += `&tier=${tierFilter}`;
        if (statusFilter) url += `&status=${statusFilter}`;
        if (debouncedScoreMin) url += `&scoreMin=${debouncedScoreMin}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Zone fetch failed");
        const data = await safeJson(res);
        setGeofencedLeads(data.leads || []);
      } catch (err) {
        console.error("Geofence query failed:", err);
        setGeofencedLeads([]);
      } finally {
        setLoading(false);
      }
    },
    [tierFilter, statusFilter, debouncedScoreMin]
  );

  useEffect(() => {
    if (geofenceBounds) {
      handleGeofenceDrawn(geofenceBounds);
    }
  }, [geofenceBounds, handleGeofenceDrawn]);

  const clearGeofence = () => {
    setGeofenceBounds(null);
    setGeofencedLeads([]);
  };

  const handleTargetedScrape = async () => {
    if (!geofenceBounds) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sources: ['alforsan', 'rotary', 'adec'], // defaults
          criteria: {
            propertyTypes: ["apartment", "villa"],
            emirates: ["Dubai"],
            bounds: geofenceBounds,
            recentlyRelocated: false,
            excludeRental: false,
            tierMin: 1
          }
        }),
      });

      if (!res.ok) throw new Error("Scrape trigger failed");
      const data = await safeJson(res);
      
      if (data.runId) {
        setActiveRunId(data.runId);
      }
      
      const { toast } = await import("sonner");
      toast.success(t("search.scrapeStarted", "Scrape job started successfully. Tracking progress..."));
    } catch (err) {
      console.error(err);
      const { toast } = await import("sonner");
      toast.error(t("search.scrapeError", "Failed to start scrape job"));
    } finally {
      setLoading(false);
    }
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
        <div className="flex items-center gap-3 p-3 bg-[#E1F5EE] border border-[#1D9E75]/30 rounded-xl shadow-sm">
          <Target className="w-4 h-4 text-[#1D9E75] flex-shrink-0" />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 flex-1">
            <span className="text-sm text-[#1D9E75] font-medium">
              {t("map.geofenceResult", "{{count}} leads found in your geo-fence zone.", {
                count: geofencedLeads.length,
              })}
            </span>
            <button
              onClick={handleTargetedScrape}
              disabled={loading || isPolling}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1D9E75] text-white text-xs font-bold hover:bg-[#188562] transition-colors shadow-sm disabled:opacity-50"
            >
              {(loading || isPolling) ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {t("map.targetScrape", "Targeted Scrape for this Zone")}
            </button>
          </div>
          <button
            onClick={clearGeofence}
            className="ms-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/50 hover:bg-white text-[#1D9E75] text-xs font-bold border border-[#1D9E75]/20 transition-colors"
          >
            <X className="w-3 h-3" />
            {t("map.clearZone", "Clear Zone")}
          </button>
        </div>
      )}

      {/* Active Scrape Progress Banner */}
      {activeRunId && (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-primary)] rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center gap-4">
          <div className="absolute top-0 start-0 w-1 bg-[var(--color-primary)] h-full" />
          {isPolling ? (
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
            </div>
          ) : runStatus === "COMPLETED" ? (
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Thermometer className="w-5 h-5 text-green-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          )}

          <div className="flex-1 text-center md:text-start">
            <h3 className="font-bold text-[var(--color-text-primary)]">
              {isPolling
                ? t("search.scrapeInProgress", "Scraping in progress...")
                : runStatus === "COMPLETED"
                ? t("search.scrapeComplete", "Scraping complete!")
                : t("search.scrapeFailed", "Scraping failed")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {isPolling
                ? t("search.scrapeWait", "Please wait while we extract data from the targeted zone. It may take a few minutes.")
                : runStatus === "COMPLETED"
                ? t("search.scrapeFound", "We found {{count}} leads.", { count: leadsFound })
                : t("search.scrapeErrorDesc", "An error occurred during the scrape job.")}
            </p>
          </div>

          {isPolling ? (
            <div className="text-center">
              <div className="text-3xl font-black text-[var(--color-primary)] leading-none">{leadsFound}</div>
              <div className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mt-1">
                {t("search.leadsFound", "Leads Found")}
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setActiveRunId(null);
                if (geofenceBounds) handleGeofenceDrawn(geofenceBounds); // refresh area
                else fetchLeads(); // refresh all
              }}
              className="px-4 py-2 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] rounded-xl text-sm font-bold border border-[var(--color-border)] hover:bg-[var(--color-bg-card)] transition-colors"
            >
              {t("search.viewResults", "View Results")}
            </button>
          )}
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
              onAction={(lead) => setSidebarLead(lead as unknown as Lead)}
            />
          )}

          {/* Full Lead Sidebar */}
          <LeadSidebar 
            lead={sidebarLead} 
            onClose={() => setSidebarLead(null)} 
          />

          {/* Layer indicator badge */}
          <div className="absolute top-4 inset-inline-end-4 z-[900] flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-white text-xs font-bold">
            {activeLayer === "markers" ? (
              <MapPin className="w-3.5 h-3.5" />
            ) : (
              <Thermometer className="w-3.5 h-3.5" />
            )}
            {layers.find((l) => l.id === activeLayer)?.label}
          </div>

          {activeLayer === "heatmap" && (
            <div className="absolute bottom-4 inset-inline-start-4 z-[900] w-72 rounded-2xl border border-white/40 bg-white/95 p-3 shadow-2xl shadow-slate-900/10 backdrop-blur">
              <div className="text-[var(--color-text-primary)] text-xs font-bold uppercase tracking-widest mb-2">
                {t("map.heatmapLegend.title", "Demand Heatmap")}
              </div>
              <div className="space-y-2 text-[var(--color-text-secondary)] text-xs mb-3">
                <div>{t("map.heatmapLegend.description", "Map demand intensity across the UAE using lead score and priority source tier.")}</div>
              </div>
              <div className="space-y-2 text-[var(--color-text-secondary)] text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#A32D2D] flex-shrink-0" />
                  {t("map.heatmapLegend.high", "High demand")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#BA7517] flex-shrink-0" />
                  {t("map.heatmapLegend.medium", "Medium demand")}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#185FA5] flex-shrink-0" />
                  {t("map.heatmapLegend.low", "Low demand")}
                </div>
              </div>
            </div>
          )}
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
