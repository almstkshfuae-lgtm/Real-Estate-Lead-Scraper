"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";

import { UAE_AREAS, GLOBAL_AREAS, getCoords } from "@/lib/areas";


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
  onAction: (lead: MapLead) => void;
  onProjectAction?: (project: any) => void;
  geofenceActive: boolean;
  onGeofenceDrawn: (bounds: { north: number; south: number; east: number; west: number }) => void;
  isAdmin?: boolean;
  onAddProjectClick?: (lat: number, lng: number) => void;
}

function GeoMap({
  leads,
  projects = [],
  language,
  activeLayer,
  onAction,
  onProjectAction,
  geofenceActive,
  onGeofenceDrawn,
  isAdmin = false,
  onAddProjectClick,
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

      // Create bounds for World
      const maxBounds = L.latLngBounds(
        L.latLng(-90, -180), // South-West
        L.latLng(90, 180)   // North-East
      );

      const map = L.map(mapRef.current!, {
        center: [25.2048, 55.2708],
        zoom: 3,
        minZoom: 2,
        maxBounds: maxBounds,
        maxBoundsViscosity: 0.5,
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
        // Render every single lead as its own marker, applying a random jitter to prevent perfect overlap
        leads.forEach((lead, index) => {
          const baseCoords = getCoords(lead.location || "Unknown", lead.id);
          if (!baseCoords) return;

          const tierColor = getTierColor(lead.tier);
          const scoreColor = getScoreColor(lead.score);

          const icon = L.divIcon({
            className: "",
            html: `
              <div style="position: relative; width: 44px; height: 44px;">
                <div style="
                  position: absolute; inset: 0; border-radius: 50%;
                  background: ${tierColor}22; border: 2px solid ${tierColor};
                  animation: pulse-map 2s infinite;
                "></div>
                <div style="
                  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                  width: 32px; height: 32px; border-radius: 50%; background: ${tierColor};
                  display: flex; align-items: center; justify-content: center;
                  font-size: 11px; font-weight: 700; color: white;
                  box-shadow: 0 2px 8px ${tierColor}66; cursor: pointer;
                  font-family: ${language === 'ar' ? "'Cairo', 'Tajawal', system-ui" : "'Inter', sans-serif"};
                ">${lead.score}</div>
              </div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });

          // Jitter to spread overlapping leads in the same location
          const jitterLat = (Math.random() - 0.5) * 0.05;
          const jitterLng = (Math.random() - 0.5) * 0.05;

          const dbLat = lead.latitude !== undefined && lead.latitude !== null ? lead.latitude : null;
          const dbLng = lead.longitude !== undefined && lead.longitude !== null ? lead.longitude : null;

          let lat = dbLat ?? baseCoords.lat;
          let lng = dbLng ?? baseCoords.lng;

          // Apply jitter only if they are using the fallback baseCoords
          if (dbLat === null || dbLng === null) {
            lat += jitterLat;
            lng += jitterLng;
          }

          const marker = L.marker([lat, lng], { icon });

          const displayName = (language === "ar" && lead.nameAr) ? lead.nameAr : lead.name;
          const signals = Array.isArray(lead.signals) ? lead.signals : [];
          const dirAttr = language === "ar" ? 'dir="rtl"' : 'dir="ltr"';
          const fontFamily = language === "ar" ? "'Cairo', 'Tajawal', system-ui, sans-serif" : "'Inter', sans-serif";

          marker.bindPopup(`
            <div ${dirAttr} style="font-family: ${fontFamily}; min-width: 240px; padding: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="font-weight: 800; font-size: 15px; color: #111827; margin-bottom: 2px;">${displayName}</div>
                <div style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; color: white; background: ${scoreColor}; flex-shrink: 0;">${lead.score}</div>
              </div>
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 12px; font-weight: 500;">${lead.company}</div>
              
              <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;">
                <span style="padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: ${tierColor}15; color: ${tierColor};">T${lead.tier}</span>
                <span style="padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #F3F4F6; color: #4B5563;">${lead.status}</span>
              </div>
              
              <div style="font-size: 11px; color: #6B7280; display: flex; align-items: center; gap: 4px; margin-bottom: 16px;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                ${lead.location}
              </div>

              <button class="view-profile-btn" style="width: 100%; padding: 8px; background: #185FA5; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ${language === 'ar' ? 'عرض الملف الكامل' : 'View Full Profile'}
              </button>
            </div>
          `, { maxWidth: 300, className: "custom-lead-popup" });

          marker.on('popupopen', (e) => {
            const popupNode = e.popup.getElement();
            const btn = popupNode?.querySelector('.view-profile-btn');
            if (btn) {
              (btn as HTMLElement).onclick = () => {
                onAction(lead);
              };
            }
          });

          marker.addTo(map);
          markersRef.current.push(marker);
        });
      } else if (activeLayer === "heatmap") {
        const heatGroup = L.layerGroup();

        // 1. Plot Real Estate Projects directly as detailed cards
        projects.forEach((proj) => {
          const lat = proj.lat ?? proj.latitude;
          const lng = proj.lng ?? proj.longitude;
          if (!lat || !lng) return;

          const formatPrice = (price: number) => {
            if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M';
            if (price >= 1000) return (price / 1000).toFixed(0) + 'K';
            return price.toString();
          };

          const priceText = proj.startingPrice ? `AED ${formatPrice(proj.startingPrice)}` : 'TBA';
          const projectName = proj.projectName || proj.name || 'Project';

          // A beautiful rectangular card that displays the project details
          const icon = L.divIcon({
            className: "custom-project-card",
            html: `
              <div style="
                width: 160px;
                background: white;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                padding: 6px 10px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                display: flex;
                flex-direction: column;
                align-items: center;
                position: relative;
                cursor: pointer;
                transition: transform 0.2s;
              " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <div style="width: 100%; font-size: 11px; font-weight: 800; color: #111827; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;">${projectName}</div>
                <div style="font-size: 12px; font-weight: 700; color: #1D9E75; background: #D1FAE5; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${priceText}</div>
                <div style="
                  position: absolute;
                  bottom: -6px;
                  left: 50%;
                  transform: translateX(-50%);
                  width: 0; 
                  height: 0; 
                  border-left: 6px solid transparent;
                  border-right: 6px solid transparent;
                  border-top: 6px solid white;
                "></div>
              </div>
            `,
            iconSize: [160, 50],
            iconAnchor: [80, 50],
          });

          const marker = L.marker([lat, lng], { icon, zIndexOffset: 1000 });

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

                <button class="view-project-btn" style="width: 100%; padding: 8px; margin-top: 12px; background: #1D9E75; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: opacity 0.2s;" onmouseover="this.style.opacity=0.9" onmouseout="this.style.opacity=1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  ${language === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                </button>
              </div>
            </div>
          `, { maxWidth: 300, className: "custom-project-popup" });

          marker.on('popupopen', (e: any) => {
            const popupNode = e.popup.getElement();
            const btn = popupNode?.querySelector('.view-project-btn');
            if (btn && onProjectAction) {
              (btn as HTMLElement).onclick = () => {
                onProjectAction(proj);
              };
            }
          });

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
  }, [leads, projects, activeLayer, language]);

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

  // Map click handler for adding projects (Admin on Heatmap layer)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (activeLayer !== "heatmap" || !isAdmin || geofenceActive) {
      return;
    }

    const handleMapClick = async (e: any) => {
      const L = (await import("leaflet")).default;
      
      const isAr = language === "ar";
      const fontFamily = isAr ? "'Cairo', 'Tajawal', system-ui, sans-serif" : "'Inter', sans-serif";
      
      const popupContent = L.DomUtil.create("div", "add-project-map-popup");
      popupContent.innerHTML = `
        <div style="font-family: ${fontFamily}; text-align: center; padding: 4px; min-width: 160px;">
          <p style="font-size: 13px; font-weight: bold; color: #111827; margin: 0 0 6px 0;">
            ${isAr ? 'إضافة مشروع هنا؟' : 'Add project here?'}
          </p>
          <p style="font-size: 11px; color: #6B7280; margin: 0 0 10px 0;">
            ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}
          </p>
          <button class="add-proj-here-btn" style="
            background: #185FA5; color: white; border: none; padding: 6px 12px;
            font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;
            width: 100%; transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#0f4a82'" onmouseout="this.style.backgroundColor='#185FA5'">
            ${isAr ? 'إضافة مشروع جديد' : 'Add New Project'}
          </button>
        </div>
      `;

      const popup = L.popup()
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);

      // Listen for button click
      const btn = popupContent.querySelector(".add-proj-here-btn");
      if (btn) {
        (btn as HTMLButtonElement).onclick = () => {
          map.closePopup();
          if (onAddProjectClick) {
            onAddProjectClick(e.latlng.lat, e.latlng.lng);
          }
        };
      }
    };

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
    };
  }, [activeLayer, isAdmin, geofenceActive, language, onAddProjectClick]);

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
        dir="ltr"
        className="w-full h-full rounded-2xl overflow-hidden"
        style={{ minHeight: "500px" }}
      />
    </>
  );
}

export default memo(GeoMap);
