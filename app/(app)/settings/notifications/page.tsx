"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Mail, Smartphone, Zap, FileSpreadsheet, MessageSquare, Save, Globe, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type NotificationPrefs = {
  emailAlerts: boolean;
  pushNotifications: boolean;
  newLeadAlerts: boolean;
  scrapeCompletion: boolean;
  weeklyDigest: boolean;
  whatsappAlerts: boolean;
  whatsappPhoneNumber: string;
};

const DEFAULT_PREFS: NotificationPrefs = {
  emailAlerts: true,
  pushNotifications: false,
  newLeadAlerts: true,
  scrapeCompletion: true,
  weeklyDigest: false,
  whatsappAlerts: false,
  whatsappPhoneNumber: "",
};

// ── Toggle sub-component (defined outside to avoid re-creation on render) ──
function NotificationToggle({
  title,
  description,
  checked,
  onChange,
  icon: Icon,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] hover:bg-[var(--color-primary-subtle)] transition-colors">
      <div className="p-2 rounded-lg bg-[var(--color-primary-subtle)] text-[var(--color-primary)] shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
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
        {/* Toggle track — uses CSS var tokens for primary color & dark-mode compat */}
        <div className="w-11 h-6 bg-[var(--color-border)] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary-subtle)] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-[var(--color-border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
      </label>
    </div>
  );
}

export default function NotificationsSettingsPage() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";

  const [preferences, setPreferences] = useState<NotificationPrefs>(DEFAULT_PREFS);
  // Snapshot of last-saved state so we can rollback on failure
  const lastSavedRef = useRef<NotificationPrefs>(DEFAULT_PREFS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Fetch current preferences from server (once on mount) ─────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/notifications")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data.preferences) {
          const merged = { ...DEFAULT_PREFS, ...data.preferences };
          setPreferences(merged);
          lastSavedRef.current = merged;
        }
      })
      .catch((err) => console.error("Failed to fetch preferences:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Browser push permission ───────────────────────────────────────
  const requestBrowserPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      toast.error(
        t("settings.notifications.pushUnsupported", "Browser notifications are not supported in this environment."),
      );
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error(
        t("settings.notifications.pushDenied", "Please allow browser notifications to enable this feature."),
      );
      return false;
    }

    return true;
  }, [t]);

  // ── Toggle a single preference key ────────────────────────────────
  const togglePreference = useCallback(
    async (key: keyof NotificationPrefs) => {
      if (key === "pushNotifications" && !preferences.pushNotifications) {
        const granted = await requestBrowserPermission();
        if (!granted) return;
      }

      setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [preferences.pushNotifications, requestBrowserPermission],
  );

  // ── Save to server with rollback on failure ───────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    // Capture current state before the request
    const snapshot = { ...preferences };
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: snapshot }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }

      // Server confirmed — update the "last saved" anchor
      lastSavedRef.current = snapshot;
      toast.success(
        t("settings.notifications.saved", "Notification preferences saved successfully."),
      );
    } catch (e: any) {
      // Rollback UI to the last known-good server state
      setPreferences(lastSavedRef.current);
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  }, [preferences, t]);

  // ── Loading state ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header + Save */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("settings.notifications.title", "Notification Preferences")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("settings.notifications.subtitle", "Control how and when you receive alerts from Brilliance.")}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving
            ? t("common.saving", "Saving...")
            : t("common.saveChanges", "Save Changes")}
        </button>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Delivery Channels ────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Globe className="w-5 h-5 text-[var(--color-text-secondary)]" />
            {t("settings.notifications.channels", "Delivery Channels")}
          </h2>

          <NotificationToggle
            title={t("settings.notifications.email", "Email Notifications")}
            description={t("settings.notifications.emailDesc", "Receive daily summaries and critical alerts via email.")}
            checked={preferences.emailAlerts}
            onChange={() => togglePreference("emailAlerts")}
            icon={Mail}
          />

          <NotificationToggle
            title={t("settings.notifications.push", "Push Notifications")}
            description={t("settings.notifications.pushDesc", "Real-time browser notifications for urgent events.")}
            checked={preferences.pushNotifications}
            onChange={() => togglePreference("pushNotifications")}
            icon={Smartphone}
          />

          <NotificationToggle
            title={t("settings.notifications.whatsapp", "WhatsApp Alerts")}
            description={t("settings.notifications.whatsappDesc", "Get notified of elite leads instantly on WhatsApp.")}
            checked={preferences.whatsappAlerts}
            onChange={() => togglePreference("whatsappAlerts")}
            icon={MessageSquare}
          />

          {/* WhatsApp phone number — visible only when whatsapp is on */}
          {preferences.whatsappAlerts && (
            <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                {t("settings.notifications.whatsappPhone", "WhatsApp notification number")}
              </label>
              <input
                type="tel"
                dir="ltr"
                value={preferences.whatsappPhoneNumber ?? ""}
                onChange={(e) =>
                  setPreferences((prev) => ({
                    ...prev,
                    whatsappPhoneNumber: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary-subtle)] transition-all"
                placeholder={t("settings.notifications.whatsappPhonePlaceholder", "+971501234567")}
              />
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t(
                  "settings.notifications.whatsappPhoneDesc",
                  "Use international format without spaces so we can deliver WhatsApp alerts to your number.",
                )}
              </p>
            </div>
          )}
        </div>

        {/* ── Event Triggers ───────────────────────────────────────── */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[var(--color-text-secondary)]" />
            {t("settings.notifications.events", "Event Triggers")}
          </h2>

          <NotificationToggle
            title={t("settings.notifications.newLeads", "New Elite Leads")}
            description={t("settings.notifications.newLeadsDesc", "Alert me when new Tier 1 leads are discovered.")}
            checked={preferences.newLeadAlerts}
            onChange={() => togglePreference("newLeadAlerts")}
            icon={Zap}
          />

          <NotificationToggle
            title={t("settings.notifications.scrape", "Scrape Completion")}
            description={t("settings.notifications.scrapeDesc", "Notify me when an intelligence scrape job finishes.")}
            checked={preferences.scrapeCompletion}
            onChange={() => togglePreference("scrapeCompletion")}
            icon={FileSpreadsheet}
          />

          <NotificationToggle
            title={t("settings.notifications.digest", "Weekly Digest")}
            description={t("settings.notifications.digestDesc", "A weekly performance report of your lead pipeline.")}
            checked={preferences.weeklyDigest}
            onChange={() => togglePreference("weeklyDigest")}
            icon={Mail}
          />
        </div>
      </div>
    </div>
  );
}
