"use client";

import { useTranslation } from "react-i18next";
import { Megaphone, Construction, Send, Users, BarChart3 } from "lucide-react";

export default function CampaignsPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('campaigns.title', 'Campaign Manager')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('campaigns.subtitle', 'Manage Bitrix24 campaigns and automated outreach.')}
          </p>
        </div>
      </div>

      <div className="relative w-full aspect-[16/9] lg:aspect-[21/9] bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden flex flex-col items-center justify-center p-8 text-center group">
        <div className="absolute inset-0 opacity-5 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(var(--color-text-secondary) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        </div>

        <div className="relative z-10 space-y-6 max-w-md">
          <div className="w-20 h-20 bg-[var(--color-primary-subtle)] rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
            <Megaphone className="w-10 h-10 text-[var(--color-primary)]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              {t('campaigns.comingSoon', 'Campaign Manager is under development')}
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
              {t('campaigns.description', 'We are finalizing the Bitrix24 OAuth handshake and WhatsApp Business API integration to enable seamless lead distribution.')}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              { icon: Send, label: t('campaigns.feature1', 'Lead Distribution') },
              { icon: Users, label: t('campaigns.feature2', 'CRM Sync') },
              { icon: BarChart3, label: t('campaigns.feature3', 'Outreach Analytics') },
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-full text-xs font-medium text-[var(--color-text-secondary)]">
                <feature.icon className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                {feature.label}
              </div>
            ))}
          </div>

          <div className="pt-4 flex items-center justify-center gap-2 text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
            <Construction className="w-4 h-4" />
            <span>{t('campaigns.phase', 'Phase 4: Pipeline Management')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
