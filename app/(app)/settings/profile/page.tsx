"use client";

import { useTranslation } from "react-i18next";
import { User, Construction, Shield, Bell, Settings } from "lucide-react";

export default function ProfileSettingsPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('settings.profile.title', 'User Profile')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('settings.profile.subtitle', 'Manage your account settings and preferences.')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-[var(--color-bg-surface)] rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
              <User className="w-10 h-10 text-[var(--color-text-secondary)]" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {t('settings.profile.placeholder', 'Settings Interface')}
              </h2>
              <p className="text-[var(--color-text-secondary)] text-sm">
                {t('settings.profile.comingSoon', 'Profile and account management will be active in the next update.')}
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs font-bold text-[var(--color-warning)] uppercase tracking-wider">
              <Construction className="w-4 h-4" />
              <span>{t('common.maintenance', 'Under Maintenance')}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { icon: Shield, label: t('settings.profile.security', 'Security & Auth') },
            { icon: Bell, label: t('settings.profile.notifications', 'Notifications') },
            { icon: Settings, label: t('settings.profile.preferences', 'Preferences') }
          ].map((item, idx) => (
            <div key={idx} className="p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl flex items-center gap-3 opacity-50 cursor-not-allowed">
              <item.icon className="w-5 h-5 text-[var(--color-text-secondary)]" />
              <span className="font-medium text-sm text-[var(--color-text-primary)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
