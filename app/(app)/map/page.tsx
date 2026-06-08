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
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<LayerType>("markers");
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

      const [leadsRes, projectsRes] = await Promise.all([
        fetch(url),
        fetch("/api/projects/heatmap")
      ]);

      if (!leadsRes.ok) throw new Error("Fetch failed");
      const data = await safeJson(leadsRes);

      const sanitizedLeads = (data.leads || []).map((l: any) => ({
        ...l,
        signals: Array.isArray(l.signals) ? l.signals : []
      }));

      setLeads(sanitizedLeads);

      if (projectsRes.ok) {
        const projData = await safeJson(projectsRes);
        setProjects(projData.projects || []);
      }
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

        const sanitizedLeads = (data.leads || []).map((l: any) => ({
          ...l,
          signals: Array.isArray(l.signals) ? l.signals : []
        }));

        setGeofencedLeads(sanitizedLeads);
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
      label: t("map.layer.heatmap", "Real Estate Projects"),
      icon: Thermometer,
      desc: t("map.layer.heatmapDesc", "View all active real estate projects"),
    },
  ];

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-sm bg-[var(--color-bg-surface)]">
      {/* Active Scrape Progress Banner - kept at top if active */}
      {activeRunId && (
        <div className="bg-[var(--color-bg-card)] border-b border-[var(--color-primary)] p-3 shadow-sm relative flex flex-col md:flex-row items-center gap-4 shrink-0 z-10">
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

      {/* Main Container */}
      <div className="flex-1 relative flex overflow-hidden">
        
        {/* Map Area */}
        <div className="flex-1 relative h-full">
          {/* Map */}
          <GeoMap
            leads={leads}
            projects={projects}
            language={i18n.language}
            activeLayer={activeLayer}
            onAction={(lead) => setSidebarLead(lead as unknown as Lead)}
            geofenceActive={geofenceActive}
            onGeofenceDrawn={handleGeofenceDrawn}
          />

          {/* Floating UI OVER the map */}
          {/* 1. Header / Filters (Top Left) */}
          <div className="absolute top-4 inset-inline-start-4 z-[900] flex flex-col gap-3 pointer-events-none max-w-[280px] sm:max-w-sm">
             <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/50 pointer-events-auto">
                <h1 className="text-xl font-black text-[var(--color-text-primary)] leading-tight mb-1">
                  {t("map.title", "Geo-Intelligence Map")}
                </h1>
                <p className="text-[var(--color-text-secondary)] text-xs mb-3 font-medium">
                  {t("map.subtitle", "Visualize lead clusters and demand signals across the UAE.")}
                </p>

                {/* Filters */}
                <div className="flex flex-col gap-2 pt-3 border-t border-[var(--color-border)]">
                  <div className="flex gap-2">
                    <select
                      value={tierFilter}
                      onChange={(e) => setTierFilter(e.target.value ? Number(e.target.value) : "")}
                      className="flex-1 px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-bold bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    >
                      <option value="">{t("leads.tiers.all", "All Tiers")}</option>
                      <option value="1">{t("leads.tiers.t1", "T1 — Elite")}</option>
                      <option value="2">{t("leads.tiers.t2", "T2 — Premium")}</option>
                      <option value="3">{t("leads.tiers.t3", "T3 — Standard")}</option>
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-bold bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    >
                      <option value="">{t("leads.status.all", "All Statuses")}</option>
                      <option value="new">{t("leads.status.new", "New")}</option>
                      <option value="contacted">{t("leads.status.contacted", "Contacted")}</option>
                      <option value="qualified">{t("leads.status.qualified", "Qualified")}</option>
                      <option value="proposal">{t("leads.status.proposal", "Proposal")}</option>
                      <option value="closed">{t("leads.status.closed", "Closed")}</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider whitespace-nowrap">
                      {t("map.filter.minScore", "Min Score")}: {scoreMin}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={95}
                      step={5}
                      value={scoreMin}
                      onChange={(e) => setScoreMin(Number(e.target.value))}
                      className="w-full accent-[#185FA5]"
                    />
                  </div>
                </div>
             </div>
          </div>

          {/* 2. Controls (Top Right) */}
          <div className="absolute top-4 inset-inline-end-4 z-[900] flex flex-col gap-2 items-end pointer-events-none">
            {/* Layer Switcher */}
            <div className="flex bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-white/50 pointer-events-auto">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => setActiveLayer(layer.id)}
                  title={layer.desc}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    activeLayer === layer.id
                      ? "bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <layer.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{layer.label}</span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  clearGeofence();
                  setGeofenceActive((v) => !v);
                }}
                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-lg border ${
                  geofenceActive
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[var(--color-primary)]/20"
                    : "bg-white/95 backdrop-blur-md text-[var(--color-text-primary)] border-white/50 hover:bg-white"
                }`}
                title={geofenceActive ? t("map.drawing", "Drawing Zone...") : t("map.drawZone", "Draw Zone")}
              >
                <Crosshair className="w-4 h-4" />
              </button>

              <button
                onClick={fetchLeads}
                disabled={loading}
                className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-md text-[var(--color-text-primary)] rounded-xl shadow-lg border border-white/50 hover:bg-white transition-all pointer-events-auto"
                title={t("common.refresh", "Refresh")}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin text-[var(--color-primary)]" : ""}`}
                />
              </button>
            </div>
          </div>

          {/* Geofence Hint / Results (Bottom Center) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[900] pointer-events-none flex flex-col items-center gap-2 w-[90%] sm:w-auto">
            {geofenceActive && (
              <div className="flex items-center gap-3 px-5 py-3 bg-[#185FA5] text-white rounded-full shadow-2xl pointer-events-auto">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-bold">
                  {t("map.geofenceHint", "Click and drag on the map to draw a geo-fence zone. Release to see leads within the zone.")}
                </span>
                <button
                  onClick={() => setGeofenceActive(false)}
                  className="ms-2 p-1.5 rounded-full hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {geofenceBounds && !geofenceActive && (
              <div className="flex flex-col sm:flex-row items-center gap-4 px-6 py-4 bg-white/95 backdrop-blur-md border border-white/50 rounded-3xl shadow-2xl pointer-events-auto">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1D9E75]/10 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5 text-[#1D9E75]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Zone Results</div>
                    <div className="text-sm font-black text-[var(--color-text-primary)]">
                      {t("map.geofenceResult", "{{count}} leads found", { count: geofencedLeads.length })}
                    </div>
                  </div>
                </div>
                
                <div className="w-px h-8 bg-[var(--color-border)] hidden sm:block" />

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTargetedScrape}
                    disabled={loading || isPolling}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#1D9E75] text-white text-sm font-bold hover:bg-[#188562] transition-colors shadow-lg shadow-[#1D9E75]/20 disabled:opacity-50"
                  >
                    {(loading || isPolling) ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    <span className="whitespace-nowrap">{t("map.targetScrape", "Targeted Scrape")}</span>
                  </button>
                  <button
                    onClick={clearGeofence}
                    className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors shrink-0"
                    title={t("map.clearZone", "Clear Zone")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Legend (Bottom Left) */}
          <div className="absolute bottom-6 inset-inline-start-4 z-[900] pointer-events-none hidden md:block">
            {activeLayer === "heatmap" ? (
              <div className="w-64 rounded-2xl border border-white/40 bg-white/95 p-4 shadow-xl backdrop-blur pointer-events-auto">
                <div className="text-[var(--color-text-primary)] text-[10px] font-bold uppercase tracking-widest mb-2">
                  {t("map.heatmapLegend.title", "Real Estate Projects")}
                </div>
                <div className="space-y-2 text-[var(--color-text-secondary)] text-xs font-medium">
                  <div>{t("map.heatmapLegend.description", "Explore premium real estate projects and developments across the UAE.")}</div>
                </div>
              </div>
            ) : (
              <div className="w-56 rounded-2xl border border-white/40 bg-white/95 p-4 shadow-xl backdrop-blur pointer-events-auto">
                <div className="text-[10px] font-bold text-[var(--color-text-primary)] uppercase tracking-widest mb-3">
                  {t("map.legend.title", "Legend")}
                </div>
                <div className="space-y-2 text-xs font-bold">
                  <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#1D9E75] flex-shrink-0" />
                      {t("map.legend.score90", "Score ≥ 90")}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#BA7517] flex-shrink-0" />
                      {t("map.legend.score75", "Score 75–89")}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#A32D2D] flex-shrink-0" />
                      {t("map.legend.scoreLow", "Score < 75")}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Geofence drawing hint overlay */}
          {geofenceActive && (
            <div className="absolute inset-0 z-10 pointer-events-none rounded-none border-4 border-dashed border-[#185FA5]/50 bg-[#185FA5]/5 animate-pulse" />
          )}

          {/* Full Lead Sidebar */}
          <LeadSidebar 
            lead={sidebarLead} 
            onClose={() => setSidebarLead(null)} 
          />
        </div>

        {/* Stats Sidebar (Right Edge) - Integrated */}
        <div className="w-80 h-full border-s border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-y-auto flex flex-col z-[800] shrink-0 hidden lg:flex">
          <div className="p-5 space-y-5">
            <MapStats
              leads={leads}
              filteredCount={leads.length}
              geofencedCount={geofencedLeads.length}
              projects={projects}
            />

            {/* Geofenced Leads List */}
            {geofencedLeads.length > 0 && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden flex flex-col shadow-sm">
                <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#1D9E75]" />
                    <span className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                      {t("map.zone.leads", "Zone Leads")} ({geofencedLeads.length})
                    </span>
                  </div>
                </div>
                <div className="p-2 space-y-1 max-h-[400px] overflow-y-auto">
                  {geofencedLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSidebarLead(lead as unknown as Lead)}
                      className="w-full text-start p-2 rounded-lg border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-primary-subtle)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
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
                          <div className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                            {i18n.language === "ar" && lead.nameAr ? lead.nameAr : lead.name}
                          </div>
                          <div className="text-[10px] font-medium text-[var(--color-text-secondary)] truncate">
                            {lead.company}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
