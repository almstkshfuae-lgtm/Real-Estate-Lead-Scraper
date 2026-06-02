"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";

// UAE community/area coordinates database
const UAE_AREAS: Record<string, { lat: number; lng: number; emirate: string }> = {
  "Dubai Marina": { lat: 25.0807, lng: 55.1400, emirate: "Dubai" },
  "Palm Jumeirah": { lat: 25.1124, lng: 55.1390, emirate: "Dubai" },
  "Downtown Dubai": { lat: 25.1972, lng: 55.2744, emirate: "Dubai" },
  "Business Bay": { lat: 25.1860, lng: 55.2650, emirate: "Dubai" },
  "Jumeirah": { lat: 25.2048, lng: 55.2455, emirate: "Dubai" },
  "DIFC": { lat: 25.2108, lng: 55.2820, emirate: "Dubai" },
  "JBR": { lat: 25.0786, lng: 55.1341, emirate: "Dubai" },
  "Arabian Ranches": { lat: 25.0536, lng: 55.2710, emirate: "Dubai" },
  "Al Barsha": { lat: 25.1127, lng: 55.1992, emirate: "Dubai" },
  "Mirdif": { lat: 25.2218, lng: 55.4224, emirate: "Dubai" },
  "Deira": { lat: 25.2697, lng: 55.3095, emirate: "Dubai" },
  "Bur Dubai": { lat: 25.2532, lng: 55.2956, emirate: "Dubai" },
  "JVC": { lat: 25.0657, lng: 55.2105, emirate: "Dubai" },
  "Yas Island": { lat: 24.4672, lng: 54.6031, emirate: "Abu Dhabi" },
  "Al Reem Island": { lat: 24.4975, lng: 54.4186, emirate: "Abu Dhabi" },
  "Saadiyat Island": { lat: 24.5404, lng: 54.4416, emirate: "Abu Dhabi" },
  "Khalidiyah": { lat: 24.4755, lng: 54.3557, emirate: "Abu Dhabi" },
  "Al Raha Beach": { lat: 24.4293, lng: 54.5697, emirate: "Abu Dhabi" },
  "Corniche": { lat: 24.4638, lng: 54.3444, emirate: "Abu Dhabi" },
  "Sharjah City": { lat: 25.3463, lng: 55.4209, emirate: "Sharjah" },
  "Al Nahda": { lat: 25.3007, lng: 55.4177, emirate: "Sharjah" },
  "Al Khan": { lat: 25.3531, lng: 55.3795, emirate: "Sharjah" },
  "Ajman": { lat: 25.4052, lng: 55.5136, emirate: "Ajman" },
  "Ras Al Khaimah": { lat: 25.7953, lng: 55.9788, emirate: "RAK" },
  "Fujairah": { lat: 25.1288, lng: 56.3265, emirate: "Fujairah" },
  "Dubai": { lat: 25.2048, lng: 55.2708, emirate: "Dubai" },
  "Abu Dhabi": { lat: 24.4539, lng: 54.3773, emirate: "Abu Dhabi" },
  "Umm Al Quwain": { lat: 25.5647, lng: 55.5534, emirate: "Umm Al Quwain" },
};

function stableHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getCoords(location: string, seed: string = ""): { lat: number; lng: number } {
  const normalized = location?.trim() || "";
  for (const [key, val] of Object.entries(UAE_AREAS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      const hash = stableHash(normalized + seed);
      const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.02;
      const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02;
      return { lat: val.lat + offsetLat, lng: val.lng + offsetLng };
    }
  }
  const hash = stableHash((normalized || "uae-fallback") + seed);
  return {
    lat: 24.4 + ((hash % 1000) / 1000) * 1.5,
    lng: 54.0 + (((hash >> 10) % 1000) / 1000) * 2.5,
  };
}

function getTierColor(tier: number): string {
  if (tier === 1) return "#3C3489";
  if (tier === 2) return "#085041";
  return "#444441";
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#1D9E75";
  if (score >= 75) return "#BA7517";
  return "#A32D2D";
}

export interface MapLead {
  id: string;
  name: string;
  nameAr?: string;
  company: string;
  role: string;
  source: string;
  location: string;
  score: number;
  tier: number;
  status: string;
  signals: string[];
  phone?: string;
  email?: string;
  notes?: string;
  budgetMin?: number;
  budgetMax?: number;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

interface GeoMapProps {
  leads: MapLead[];
  language: string;
  activeLayer: "markers" | "heatmap";
  onSelectLead: (lead: MapLead) => void;
  geofenceActive: boolean;
  onGeofenceDrawn: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

function GeoMap({
  leads,
  language,
  activeLayer,
  onSelectLead,
  geofenceActive,
  onGeofenceDrawn,
}: GeoMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const heatLayerRef = useRef<any>(null);
  const geofenceLayerRef = useRef<any>(null);
  const drawingRef = useRef(false);
  const startPointRef = useRef<any>(null);
  const rectRef = useRef<any>(null);
  const isRtl = language === "ar";

  useEffect(() => {
    // Cancellation token — set true in cleanup so async continuations abort
    let cancelled = false;

    const initMap = async () => {
      if (!mapRef.current) return;

      // Synchronous pre-check: skip if Leaflet already owns this node
      if ((mapRef.current as any)._leaflet_id) return;

      const L = (await import("leaflet")).default;
      // ← cleanup may have fired here in Strict Mode; bail if so
      if (cancelled || !mapRef.current) return;

      // Final guard: DOM node must still be unclaimed
      if ((mapRef.current as any)._leaflet_id) return;

      // Fix default icon path issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [25.2048, 55.2708],
        zoom: 9,
        zoomControl: false,
        attributionControl: true,
      });

      // Clean professional tile layer (CartoDB Positron - elegant light grey)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      // Zoom control on correct side for RTL
      L.control.zoom({ position: isRtl ? "topright" : "topleft" }).addTo(map);

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      // Strip Leaflet's internal flag so a fresh re-mount starts clean
      if (mapRef.current) {
        delete (mapRef.current as any)._leaflet_id;
      }
    };
  }, []);

  // Render markers or heatmap based on activeLayer
  useEffect(() => {
    const updateLayers = async () => {
      const map = mapInstanceRef.current;
      if (!map) return;

      const L = (await import("leaflet")).default;

      // Clear existing markers and heatmap overlays
      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }

      if (activeLayer === "markers") {
        // Group leads by location cluster
        const clusterMap: Record<string, MapLead[]> = {};
        leads.forEach((lead) => {
          const key = lead.location || "Unknown";
          if (!clusterMap[key]) clusterMap[key] = [];
          clusterMap[key].push(lead);
        });

        Object.entries(clusterMap).forEach(([location, clusterLeads]) => {
          const baseCoords = getCoords(location);

          if (clusterLeads.length === 1) {
            // Single lead marker
            const lead = clusterLeads[0];
            const tierColor = getTierColor(lead.tier);
            const scoreColor = getScoreColor(lead.score);

            const icon = L.divIcon({
              className: "",
              html: `
                <div style="
                  position: relative;
                  width: 44px;
                  height: 44px;
                ">
                  <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: ${tierColor}22;
                    border: 2px solid ${tierColor};
                    animation: pulse-map 2s infinite;
                  "></div>
                  <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: ${tierColor};
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: 700;
                    color: white;
                    box-shadow: 0 2px 8px ${tierColor}66;
                    cursor: pointer;
                    font-family: 'Inter', sans-serif;
                  ">${lead.score}</div>
                </div>
              `,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });

            const lat = lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : getCoords(location, lead.id).lat;
            const lng = lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : getCoords(location, lead.id).lng;
            const marker = L.marker([lat, lng], { icon });
            
            const displayName = (language === "ar" && lead.nameAr) ? lead.nameAr : lead.name;
            const signals = Array.isArray(lead.signals) ? lead.signals : [];
            
            marker.bindPopup(`
              <div style="
                font-family: 'Inter', sans-serif;
                min-width: 200px;
                padding: 4px;
              ">
                <div style="font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 4px;">${displayName}</div>
                <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">${lead.company}</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                  <span style="
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    background: ${tierColor}22;
                    color: ${tierColor};
                  ">T${lead.tier}</span>
                  <span style="
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    background: ${scoreColor}22;
                    color: ${scoreColor};
                  ">Score: ${lead.score}</span>
                </div>
                <div style="font-size: 11px; color: #9CA3AF;">${lead.location}</div>
              </div>
            `, { maxWidth: 280 });

            marker.on("click", () => onSelectLead(lead));
            marker.addTo(map);
            markersRef.current.push(marker);

          } else {
            // Cluster marker
            const topTier = Math.min(...clusterLeads.map((l) => l.tier));
            const tierColor = getTierColor(topTier);
            const avgScore = Math.round(clusterLeads.reduce((s, l) => s + l.score, 0) / clusterLeads.length);

            const icon = L.divIcon({
              className: "",
              html: `
                <div style="
                  position: relative;
                  width: 56px;
                  height: 56px;
                ">
                  <div style="
                    position: absolute;
                    inset: 0;
                    border-radius: 50%;
                    background: ${tierColor}15;
                    border: 2px solid ${tierColor}66;
                  "></div>
                  <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 42px;
                    height: 42px;
                    border-radius: 50%;
                    background: ${tierColor};
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 12px ${tierColor}44;
                    cursor: pointer;
                  ">
                    <div style="font-size: 14px; font-weight: 800; font-family: 'Inter', sans-serif; line-height:1;">${clusterLeads.length}</div>
                    <div style="font-size: 9px; font-weight: 500; opacity: 0.85; font-family: 'Inter', sans-serif;">leads</div>
                  </div>
                </div>
              `,
              iconSize: [56, 56],
              iconAnchor: [28, 28],
            });

            const marker = L.marker([baseCoords.lat, baseCoords.lng], { icon });
            marker.bindPopup(`
              <div style="font-family: 'Inter', sans-serif; padding: 4px; min-width: 200px;">
                <div style="font-weight: 700; font-size: 13px; color: #111827; margin-bottom: 2px;">${location}</div>
                <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">${clusterLeads.length} leads · Avg Score ${avgScore}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${clusterLeads.slice(0, 5).map(l => `
                    <span style="
                      font-size: 11px;
                      padding: 2px 6px;
                      background: #F0F2F5;
                      border-radius: 4px;
                      color: #374151;
                    ">${l.name}</span>
                  `).join("")}
                  ${clusterLeads.length > 5 ? `<span style="font-size: 11px; color: #9CA3AF;">+${clusterLeads.length - 5} more</span>` : ""}
                </div>
              </div>
            `, { maxWidth: 280 });
            marker.addTo(map);
            markersRef.current.push(marker);
          }
        });

      } else if (activeLayer === "heatmap") {
        const heatGroup = L.layerGroup();

        leads.forEach((lead) => {
          const lat = lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : getCoords(lead.location, lead.id).lat;
          const lng = lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : getCoords(lead.location, lead.id).lng;
          
          const bMax = typeof lead.budgetMax === "number" && !isNaN(lead.budgetMax) ? lead.budgetMax : 0;
          const bMin = typeof lead.budgetMin === "number" && !isNaN(lead.budgetMin) ? lead.budgetMin : 0;
          const maxBudgetVal = Math.max(bMax, bMin);
          
          const budgetMultiplier = maxBudgetVal > 0 
            ? 1.0 + Math.min(1.5, maxBudgetVal / 10000000) 
            : 1.0;

          const tierWeight = lead.tier === 1 ? 3 : lead.tier === 2 ? 2 : 1;
          const rawWeight = (lead.score / 100) * tierWeight * budgetMultiplier;
          const intensity = Math.max(0.12, Math.min(1, rawWeight / 7.5));
          
          const radius = 16000 + 22000 * intensity;
          const alpha = 0.16 + intensity * 0.24;
          const color = intensity > 0.7 ? "#A32D2D" : intensity > 0.4 ? "#BA7517" : "#185FA5";

          const circle = L.circle([lat, lng], {
            radius,
            color: "transparent",
            fillColor: color,
            fillOpacity: alpha,
            interactive: false,
          });

          heatGroup.addLayer(circle);
        });

        heatGroup.addTo(map);
        heatLayerRef.current = heatGroup;
      }
    };

    if (mapInstanceRef.current) {
      updateLayers();
    } else {
      // Wait for map to initialize
      const interval = setInterval(() => {
        if (mapInstanceRef.current) {
          clearInterval(interval);
          updateLayers();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [leads, activeLayer, language]);

  // Geofence drawing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const L_import = import("leaflet");

    if (!geofenceActive) {
      // Clean up
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
      map.getContainer().style.cursor = "";
      return;
    }

    map.getContainer().style.cursor = "crosshair";

    const handleMouseDown = async (e: any) => {
      const L = (await L_import).default;
      drawingRef.current = true;
      startPointRef.current = e.latlng;

      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
    };

    const handleMouseMove = async (e: any) => {
      if (!drawingRef.current || !startPointRef.current) return;
      const L = (await L_import).default;

      const bounds = L.latLngBounds(startPointRef.current, e.latlng);
      if (rectRef.current) {
        rectRef.current.setBounds(bounds);
      } else {
        rectRef.current = L.rectangle(bounds, {
          color: "#185FA5",
          weight: 2,
          fillColor: "#185FA5",
          fillOpacity: 0.1,
          dashArray: "6 4",
        }).addTo(map);
      }
    };

    const handleMouseUp = async (e: any) => {
      if (!drawingRef.current || !startPointRef.current) return;
      const L = (await L_import).default;
      drawingRef.current = false;

      const bounds = L.latLngBounds(startPointRef.current, e.latlng);
      onGeofenceDrawn({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });

      startPointRef.current = null;
      map.getContainer().style.cursor = "crosshair";
    };

    map.on("mousedown", handleMouseDown);
    map.on("mousemove", handleMouseMove);
    map.on("mouseup", handleMouseUp);

    return () => {
      map.off("mousedown", handleMouseDown);
      map.off("mousemove", handleMouseMove);
      map.off("mouseup", handleMouseUp);
      map.getContainer().style.cursor = "";
    };
  }, [geofenceActive, onGeofenceDrawn]);

  return (
    <>
      <style>{`
        @keyframes pulse-map {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.6; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15) !important;
          border: 1px solid #E2E5EA;
        }
        .leaflet-popup-tip {
          background: white !important;
        }
        .leaflet-attribution-flag { display: none !important; }
      `}</style>
      <div
        ref={mapRef}
        className="w-full h-full rounded-2xl overflow-hidden"
        style={{ minHeight: "500px" }}
      />
    </>
  );
}

export default memo(GeoMap);
