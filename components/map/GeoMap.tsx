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

const GLOBAL_AREAS: Record<string, { lat: number; lng: number; emirate: string }> = {
  // Saudi Arabia
  "Riyadh": { lat: 24.7136, lng: 46.6753, emirate: "Saudi Arabia" },
  "الرياض": { lat: 24.7136, lng: 46.6753, emirate: "Saudi Arabia" },
  "Jeddah": { lat: 21.5433, lng: 39.1728, emirate: "Saudi Arabia" },
  "جدة": { lat: 21.5433, lng: 39.1728, emirate: "Saudi Arabia" },
  "Saudi Arabia": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },
  "المملكة العربية السعودية": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },
  "السعودية": { lat: 23.8859, lng: 45.0792, emirate: "Saudi Arabia" },

  // UK & Europe
  "London": { lat: 51.5074, lng: -0.1278, emirate: "UK" },
  "لندن": { lat: 51.5074, lng: -0.1278, emirate: "UK" },
  "United Kingdom": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "المملكة المتحدة": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "بريطانيا": { lat: 55.3781, lng: -3.4360, emirate: "UK" },
  "Paris": { lat: 48.8566, lng: 2.3522, emirate: "France" },
  "باريس": { lat: 48.8566, lng: 2.3522, emirate: "France" },
  "France": { lat: 46.2276, lng: 2.2137, emirate: "France" },
  "فرنسا": { lat: 46.2276, lng: 2.2137, emirate: "France" },
  "Berlin": { lat: 52.5200, lng: 13.4050, emirate: "Germany" },
  "برلين": { lat: 52.5200, lng: 13.4050, emirate: "Germany" },
  "Germany": { lat: 51.1657, lng: 10.4515, emirate: "Germany" },
  "ألمانيا": { lat: 51.1657, lng: 10.4515, emirate: "Germany" },
  "Geneva": { lat: 46.2044, lng: 6.1432, emirate: "Switzerland" },
  "جنيف": { lat: 46.2044, lng: 6.1432, emirate: "Switzerland" },
  "Zurich": { lat: 47.3769, lng: 8.5417, emirate: "Switzerland" },
  "زوريخ": { lat: 47.3769, lng: 8.5417, emirate: "Switzerland" },
  "Munich": { lat: 48.1351, lng: 11.5820, emirate: "Germany" },
  "ميونخ": { lat: 48.1351, lng: 11.5820, emirate: "Germany" },
  "Switzerland": { lat: 46.8182, lng: 8.2275, emirate: "Switzerland" },
  "سويسرا": { lat: 46.8182, lng: 8.2275, emirate: "Switzerland" },

  // North America
  "New York": { lat: 40.7128, lng: -74.0060, emirate: "USA" },
  "نيويورك": { lat: 40.7128, lng: -74.0060, emirate: "USA" },
  "California": { lat: 36.7783, lng: -119.4179, emirate: "USA" },
  "كاليفورنيا": { lat: 36.7783, lng: -119.4179, emirate: "USA" },
  "United States": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "الولايات المتحدة": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "USA": { lat: 37.0902, lng: -95.7129, emirate: "USA" },
  "Canada": { lat: 56.1304, lng: -106.3468, emirate: "Canada" },
  "كندا": { lat: 56.1304, lng: -106.3468, emirate: "Canada" },
  "Toronto": { lat: 43.6532, lng: -79.3832, emirate: "Canada" },
  "تورونتو": { lat: 43.6532, lng: -79.3832, emirate: "Canada" },
  "Montreal": { lat: 45.5017, lng: -73.5673, emirate: "Canada" },
  "مونتريال": { lat: 45.5017, lng: -73.5673, emirate: "Canada" },
  "Vancouver": { lat: 49.2827, lng: -123.1207, emirate: "Canada" },
  "فانكوفر": { lat: 49.2827, lng: -123.1207, emirate: "Canada" },
  "Ottawa": { lat: 45.4215, lng: -75.6972, emirate: "Canada" },
  "أوتاوا": { lat: 45.4215, lng: -75.6972, emirate: "Canada" },
  "Edmonton": { lat: 53.5461, lng: -113.4938, emirate: "Canada" },
  "إدمونتون": { lat: 53.5461, lng: -113.4938, emirate: "Canada" },
  "Quebec": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },
  "كيبك": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },
  "Québec": { lat: 46.8139, lng: -71.2082, emirate: "Canada" },

  // Gulf / Middle East
  "Kuwait": { lat: 29.3759, lng: 47.9774, emirate: "Kuwait" },
  "الكويت": { lat: 29.3759, lng: 47.9774, emirate: "Kuwait" },
  "Qatar": { lat: 25.3548, lng: 51.1849, emirate: "Qatar" },
  "قطر": { lat: 25.3548, lng: 51.1849, emirate: "Qatar" },
  "Doha": { lat: 25.2854, lng: 51.5310, emirate: "Qatar" },
  "الدوحة": { lat: 25.2854, lng: 51.5310, emirate: "Qatar" },
  "Bahrain": { lat: 26.0667, lng: 50.5577, emirate: "Bahrain" },
  "البحرين": { lat: 26.0667, lng: 50.5577, emirate: "Bahrain" },
  "Manama": { lat: 26.2285, lng: 50.5860, emirate: "Bahrain" },
  "المنامة": { lat: 26.2285, lng: 50.5860, emirate: "Bahrain" },
  "Oman": { lat: 21.5126, lng: 55.9233, emirate: "Oman" },
  "عمان": { lat: 21.5126, lng: 55.9233, emirate: "Oman" },
  "Muscat": { lat: 23.5859, lng: 58.4059, emirate: "Oman" },
  "مسقط": { lat: 23.5859, lng: 58.4059, emirate: "Oman" },
  "Egypt": { lat: 26.8206, lng: 30.8025, emirate: "Egypt" },
  "مصر": { lat: 26.8206, lng: 30.8025, emirate: "Egypt" },
  "Cairo": { lat: 30.0444, lng: 31.2357, emirate: "Egypt" },
  "القاهرة": { lat: 30.0444, lng: 31.2357, emirate: "Egypt" },
  "Lebanon": { lat: 33.8547, lng: 35.8623, emirate: "Lebanon" },
  "لبنان": { lat: 33.8547, lng: 35.8623, emirate: "Lebanon" },
  "Beirut": { lat: 33.8938, lng: 35.5018, emirate: "Lebanon" },
  "بيروت": { lat: 33.8938, lng: 35.5018, emirate: "Lebanon" },
  "Jordan": { lat: 30.5852, lng: 36.2384, emirate: "Jordan" },
  "الأردن": { lat: 30.5852, lng: 36.2384, emirate: "Jordan" },
  "Amman": { lat: 31.9539, lng: 35.9106, emirate: "Jordan" },
  "عمان (الأردن)": { lat: 31.9539, lng: 35.9106, emirate: "Jordan" },

  // Asia & Russia
  "India": { lat: 20.5937, lng: 78.9629, emirate: "India" },
  "الهند": { lat: 20.5937, lng: 78.9629, emirate: "India" },
  "Mumbai": { lat: 19.0760, lng: 72.8777, emirate: "India" },
  "بومباي": { lat: 19.0760, lng: 72.8777, emirate: "India" },
  "Russia": { lat: 61.5240, lng: 105.3188, emirate: "Russia" },
  "روسيا": { lat: 61.5240, lng: 105.3188, emirate: "Russia" },
  "Moscow": { lat: 55.7558, lng: 37.6173, emirate: "Russia" },
  "موسكو": { lat: 55.7558, lng: 37.6173, emirate: "Russia" },
  "China": { lat: 35.8617, lng: 104.1954, emirate: "China" },
  "الصين": { lat: 35.8617, lng: 104.1954, emirate: "China" },
  "Turkey": { lat: 38.9637, lng: 35.2433, emirate: "Turkey" },
  "تركيا": { lat: 38.9637, lng: 35.2433, emirate: "Turkey" },
  "Istanbul": { lat: 41.0082, lng: 28.9784, emirate: "Turkey" },
  "إسطنبول": { lat: 41.0082, lng: 28.9784, emirate: "Turkey" },
  "Pakistan": { lat: 30.3753, lng: 69.3451, emirate: "Pakistan" },
  "باكستان": { lat: 30.3753, lng: 69.3451, emirate: "Pakistan" }
};

function stableHash(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getCoords(location: string, seed: string = ""): { lat: number; lng: number } | null {
  const normalized = location?.trim() || "";
  
  // 1. Try UAE Areas first
  for (const [key, val] of Object.entries(UAE_AREAS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      const hash = stableHash(normalized + seed);
      const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.02;
      const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02;
      return { lat: val.lat + offsetLat, lng: val.lng + offsetLng };
    }
  }

  // 2. Try Global Areas next
  for (const [key, val] of Object.entries(GLOBAL_AREAS)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      const hash = stableHash(normalized + seed);
      const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.02;
      const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.02;
      return { lat: val.lat + offsetLat, lng: val.lng + offsetLng };
    }
  }

  // 3. Unknown location — return fallback instead of null
  // We use a central UAE coordinate with a wider spread so leads are not hidden
  const hash = stableHash(normalized + seed + "fallback");
  const offsetLat = ((hash % 1000) / 1000 - 0.5) * 0.15;
  const offsetLng = (((hash >> 10) % 1000) / 1000 - 0.5) * 0.25;
  return { lat: 24.8 + offsetLat, lng: 55.0 + offsetLng };
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
  projects?: any[];
  language: string;
  activeLayer: "markers" | "heatmap";
  onSelectLead: (lead: MapLead) => void;
  geofenceActive: boolean;
  onGeofenceDrawn: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

function GeoMap({
  leads,
  projects = [],
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

      // Create bounds for Greater MENA / World fallback area
      const maxBounds = L.latLngBounds(
        L.latLng(-10, -30), // South-West
        L.latLng(70, 150)   // North-East
      );

      const map = L.map(mapRef.current!, {
        center: [25.2048, 55.2708],
        zoom: 9,
        minZoom: 3,
        maxBounds: maxBounds,
        maxBoundsViscosity: 1.0,
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
          if (!baseCoords) return; // Skip clusters with unresolvable location

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
                    font-family: ${language === 'ar' ? "'Cairo', 'Tajawal', system-ui" : "'Inter', sans-serif"};
                  ">${lead.score}</div>
                </div>
              `,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });

            const dbLat = lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : null;
            const dbLng = lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : null;
            const fallbackCoords = (dbLat === null || dbLng === null) ? getCoords(location, lead.id) : null;
            const lat = dbLat ?? fallbackCoords?.lat ?? null;
            const lng = dbLng ?? fallbackCoords?.lng ?? null;
            if (lat === null || lng === null) return; // Skip leads with unresolvable coordinates
            const marker = L.marker([lat, lng], { icon });
            
            const displayName = (language === "ar" && lead.nameAr) ? lead.nameAr : lead.name;
            const signals = Array.isArray(lead.signals) ? lead.signals : [];
            const dirAttr = language === "ar" ? 'dir="rtl"' : 'dir="ltr"';
            const fontFamily = language === "ar" ? "'Cairo', 'Tajawal', system-ui, sans-serif" : "'Inter', sans-serif";
            
            marker.bindPopup(`
              <div ${dirAttr} style="
                font-family: ${fontFamily};
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
                    <div style="font-size: 14px; font-weight: 800; font-family: ${language === 'ar' ? "'Cairo', 'Tajawal'" : "'Inter'"}, sans-serif; line-height:1;">${clusterLeads.length}</div>
                    <div style="font-size: 9px; font-weight: 500; opacity: 0.85; font-family: ${language === 'ar' ? "'Cairo', 'Tajawal'" : "'Inter'"}, sans-serif;">${language === 'ar' ? 'عميل' : 'leads'}</div>
                  </div>
                </div>
              `,
              iconSize: [56, 56],
              iconAnchor: [28, 28],
            });

            const marker = L.marker([baseCoords.lat, baseCoords.lng], { icon });
            const dirAttr = language === "ar" ? 'dir="rtl"' : 'dir="ltr"';
            const fontFamily = language === "ar" ? "'Cairo', 'Tajawal', system-ui, sans-serif" : "'Inter', sans-serif";
            
            marker.bindPopup(`
              <div ${dirAttr} style="font-family: ${fontFamily}; padding: 4px; min-width: 200px;">
                <div style="font-weight: 700; font-size: 13px; color: #111827; margin-bottom: 2px;">${location}</div>
                <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">${clusterLeads.length} ${language === 'ar' ? 'عميل · متوسط التقييم' : 'leads · Avg Score'} ${avgScore}</div>
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

        // 1. Plot Lead demand intensity
        leads.forEach((lead) => {
          const dbLat = lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : null;
          const dbLng = lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : null;
          const fallbackCoords = (dbLat === null || dbLng === null) ? getCoords(lead.location, lead.id) : null;
          const lat = dbLat ?? fallbackCoords?.lat ?? null;
          const lng = dbLng ?? fallbackCoords?.lng ?? null;
          if (lat === null || lng === null) return; // Skip leads with unresolvable coordinates
          
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

        // 2. Plot Real Estate Projects
        projects.forEach((proj) => {
          const lat = proj.lat ?? proj.latitude;
          const lng = proj.lng ?? proj.longitude;
          if (!lat || !lng) return;

          const formatPrice = (price: number) => {
             if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M';
             if (price >= 1000) return (price / 1000).toFixed(0) + 'K';
             return price.toString();
          };

          const icon = L.divIcon({
            className: "",
            html: `
              <div style="
                position: relative;
                width: 36px;
                height: 36px;
              ">
                <div style="
                  position: absolute;
                  inset: 0;
                  border-radius: 50%;
                  background: #185FA522;
                  border: 2px solid #185FA5;
                  animation: pulse-map 2s infinite;
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: #185FA5;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  box-shadow: 0 2px 8px #185FA566;
                ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          const marker = L.marker([lat, lng], { icon });

          const dirAttr = language === "ar" ? 'dir="rtl"' : 'dir="ltr"';
          const fontFamily = language === "ar" ? "'Cairo', 'Tajawal', system-ui, sans-serif" : "'Inter', sans-serif";
          
          marker.bindPopup(`
            <div ${dirAttr} style="
              font-family: ${fontFamily};
              min-width: 240px;
              padding: 0;
            ">
              ${proj.imageUrl ? `
                <div style="width: 100%; height: 140px; border-radius: 8px 8px 0 0; overflow: hidden; margin-bottom: 12px; background: #F3F4F6;">
                  <img src="${proj.imageUrl}" alt="${proj.projectName || proj.name || 'Project'}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              ` : ''}
              <div style="padding: ${proj.imageUrl ? '0 12px 12px 12px' : '8px'};">
                <div style="font-weight: 800; font-size: 15px; color: #111827; margin-bottom: 2px;">${proj.projectName || proj.name || 'Project'}</div>
                <div style="font-size: 11px; font-weight: 600; color: #6B7280; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">${proj.developer || 'Developer'}</div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                  <div style="background: #F8FAFC; padding: 8px; border-radius: 8px; border: 1px solid #F1F5F9;">
                    <div style="font-size: 10px; color: #64748B;">Starting Price</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0F172A;">AED ${formatPrice(proj.startingPrice || 0)}</div>
                  </div>
                  <div style="background: #F8FAFC; padding: 8px; border-radius: 8px; border: 1px solid #F1F5F9;">
                    <div style="font-size: 10px; color: #64748B;">Area (Sqft)</div>
                    <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${proj.areaSqft || proj.area || '-'}</div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
                  <div style="color: #64748B; display: flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${proj.location || 'UAE'}
                  </div>
                  <div style="color: #059669; font-weight: 600; background: #D1FAE5; padding: 2px 6px; border-radius: 4px;">${proj.handover || 'TBA'}</div>
                </div>
              </div>
            </div>
          `, { maxWidth: 300, className: "custom-project-popup" });

          heatGroup.addLayer(marker);
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
