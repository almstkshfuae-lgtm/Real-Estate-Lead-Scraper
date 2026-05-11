"use client";

import { useTranslation } from "react-i18next";
import { Map as MapIcon, Construction, MapPin, Layers, Info } from "lucide-react";

export default function MapPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('map.title', 'Geo-Intelligence Map')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('map.subtitle', 'Visualize lead clusters and demand signals across the UAE.')}
          </p>
        </div>
      </div>

      <div className="relative w-full aspect-[16/9] lg:aspect-[21/9] bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col items-center justify-center p-8 text-center group">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(var(--color-text-secondary) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="w-20 h-20 bg-[var(--color-primary-subtle)] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
            <MapIcon className="w-10 h-10 text-[var(--color-primary)]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {t('map.comingSoon', 'Map View is under development')}
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
              {t('map.description', 'We are currently integrating Mapbox to provide high-precision lead clustering, heatmaps, and geo-fencing for your target scrapes.')}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: MapPin, label: t('map.feature1', 'Lead Clustering') },
              { icon: Layers, label: t('map.feature2', 'Heatmaps') },
              { icon: Info, label: t('map.feature3', 'Demand Signals') },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-full text-xs font-medium text-[var(--color-text-secondary)]">
                <feature.icon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                {feature.label}
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
            <Construction className="w-4 h-4" />
            <span>{t('map.phase', 'Phase 5: Geo-Intelligence')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            title: t('map.upcoming.clusters.title', 'Regional Clustering'),
            desc: t('map.upcoming.clusters.desc', 'Identify high-value buyer clusters in specific communities like Palm Jumeirah, Downtown Dubai, and Yas Island.')
          },
          {
            title: t('map.upcoming.heatmap.title', 'Demand Heatmaps'),
            desc: t('map.upcoming.heatmap.desc', 'Visualize where investors are currently searching for properties based on real-time scraper signals.')
          },
          {
            title: t('map.upcoming.geofence.title', 'Geo-Fenced Scrapes'),
            desc: t('map.upcoming.geofence.desc', 'Trigger intelligence scrapes for specific geographical areas to find local business owners and residents.')
          }
        ].map((item, i) => (
          <div key={i} className="p-6 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl space-y-2">
            <h3 className="font-bold text-[var(--color-text-primary)]">{item.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
