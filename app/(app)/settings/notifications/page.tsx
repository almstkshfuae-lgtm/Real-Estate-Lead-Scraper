"use client";

import { useState, useEffect } from "react";
import { Bell, Mail, Smartphone, Zap, FileSpreadsheet, MessageSquare, Save, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function NotificationsSettingsPage() {
  const { t } = useTranslation('common');
  
  const [preferences, setPreferences] = useState({
    emailAlerts: true,
    pushNotifications: false,
    newLeadAlerts: true,
    scrapeCompletion: true,
    weeklyDigest: false,
    whatsappAlerts: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/notifications")
      .then(res => res.json())
      .then(data => {
        if (data.preferences) {
          setPreferences(data.preferences);
        }
      })
      .catch(err => console.error("Failed to fetch preferences:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences })
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t('settings.notifications.saved', 'Notification preferences saved successfully.'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const NotificationToggle = ({ 
    title, 
    description, 
    checked, 
    onChange, 
    icon: Icon 
  }: { 
    title: string; 
    description: string; 
    checked: boolean; 
    onChange: () => void; 
    icon: any 
  }) => (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-surface-hover)] transition-colors">
      <div className="p-2 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-[var(--color-text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
        <input 
          type="checkbox" 
          className="sr-only peer" 
          checked={checked} 
          onChange={onChange} 
        />
        <div className="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
      </label>
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('settings.notifications.title', 'Notification Preferences')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('settings.notifications.subtitle', 'Control how and when you receive alerts from Brilliance.')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--color-text-secondary)]" />
            {t('settings.notifications.channels', 'Delivery Channels')}
          </h2>
          
          <NotificationToggle
            title={t('settings.notifications.email', 'Email Notifications')}
            description={t('settings.notifications.emailDesc', 'Receive daily summaries and critical alerts via email.')}
            checked={preferences.emailAlerts}
            onChange={() => togglePreference('emailAlerts')}
            icon={Mail}
          />
          
          <NotificationToggle
            title={t('settings.notifications.push', 'Push Notifications')}
            description={t('settings.notifications.pushDesc', 'Real-time browser notifications for urgent events.')}
            checked={preferences.pushNotifications}
            onChange={() => togglePreference('pushNotifications')}
            icon={Smartphone}
          />
          
          <NotificationToggle
            title={t('settings.notifications.whatsapp', 'WhatsApp Alerts')}
            description={t('settings.notifications.whatsappDesc', 'Get notified of elite leads instantly on WhatsApp.')}
            checked={preferences.whatsappAlerts}
            onChange={() => togglePreference('whatsappAlerts')}
            icon={MessageSquare}
          />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
            {t('settings.notifications.events', 'Event Triggers')}
          </h2>
          
          <NotificationToggle
            title={t('settings.notifications.newLeads', 'New Elite Leads')}
            description={t('settings.notifications.newLeadsDesc', 'Alert me when new Tier 1 leads are discovered.')}
            checked={preferences.newLeadAlerts}
            onChange={() => togglePreference('newLeadAlerts')}
            icon={Zap}
          />
          
          <NotificationToggle
            title={t('settings.notifications.scrape', 'Scrape Completion')}
            description={t('settings.notifications.scrapeDesc', 'Notify me when an intelligence scrape job finishes.')}
            checked={preferences.scrapeCompletion}
            onChange={() => togglePreference('scrapeCompletion')}
            icon={FileSpreadsheet}
          />
          
          <NotificationToggle
            title={t('settings.notifications.digest', 'Weekly Digest')}
            description={t('settings.notifications.digestDesc', 'A weekly performance report of your lead pipeline.')}
            checked={preferences.weeklyDigest}
            onChange={() => togglePreference('weeklyDigest')}
            icon={Mail}
          />
        </div>
      </div>
    </div>
  );
}
