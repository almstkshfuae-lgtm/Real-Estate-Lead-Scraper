"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Mail, Globe, Lock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";

type ProfileFormState = {
  name: string;
  email: string;
  language: string;
  theme: string;
  currentPassword: string;
  newPassword: string;
};

export default function ProfileSettingsPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  const [form, setForm] = useState<ProfileFormState>({
    name: '',
    email: '',
    language: 'en',
    theme: 'system',
    currentPassword: '',
    newPassword: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/profile')
      .then((res) => {
        // 401 = session expired or auth cookie missing — send user to login
        if (res.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!res.ok) {
          throw new Error(`Unable to fetch profile (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return; // navigating to /login, don't update state
        if (data?.user) {
          setForm((prev) => ({
            ...prev,
            name: data.user.name || '',
            email: data.user.email || '',
            language: data.user.language || 'en',
            theme: data.user.theme || 'system',
          }));
        }
      })
      .catch((error) => {
        console.error('Profile load error:', error);
        toast.error(t('settings.profile.loadError', 'Failed to load profile data.'));
      })
      .finally(() => setIsLoading(false));
  }, []); // Changed dependency from [t] to [] to prevent infinite fetches

  const handleChange = (field: keyof ProfileFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error(t('settings.profile.missingFields', 'Name and email are required.'));
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          language: form.language,
          theme: form.theme,
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const data = await safeJson(response).catch(() => ({} as any));
      if (!response.ok) {
        toast.error(data?.error || t('settings.profile.saveError', 'Failed to save profile.'));
        setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' })); // Clear passwords on error
        return;
      }

      toast.success(t('settings.profile.saveSuccess', 'Profile updated successfully.'));
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
    } catch (error: any) {
      console.error('Profile save error:', error);
      toast.error(t('settings.profile.saveError', 'Failed to save profile.'));
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' })); // Clear passwords on catch
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {t('settings.profile.title', 'User Profile')}
          </h1>
          <p className="text-text-secondary">
            {t('settings.profile.subtitle', 'Manage your account settings and preferences.')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? t('common.saving', 'Saving...') : t('common.saveChanges', 'Save Changes')}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
        <div className="space-y-6">
          <section className="p-6 rounded-3xl border border-border bg-bg-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {t('settings.profile.accountInfo', 'Account Information')}
                </h2>
                <p className="text-sm text-text-secondary">
                  {t('settings.profile.accountInfoDescription', 'Your identity and login preferences.')}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-text-secondary">
                <span>{t('settings.profile.fullName', 'Full Name')}</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </label>

              <label className="space-y-2 text-sm text-text-secondary">
                <span>{t('settings.profile.email', 'Email Address')}</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm text-text-secondary">
                  <span>{t('settings.profile.language', 'Language')}</span>
                  <select
                    value={form.language}
                    onChange={(event) => handleChange('language', event.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm text-text-secondary">
                  <span>{t('settings.profile.theme', 'Theme')}</span>
                  <select
                    value={form.theme}
                    onChange={(event) => handleChange('theme', event.target.value)}
                    disabled={isSaving}
                    className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className="p-6 rounded-3xl border border-border bg-bg-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {t('settings.profile.security', 'Security & Password')}
                </h2>
                <p className="text-sm text-text-secondary">
                  {t('settings.profile.securityDescription', 'Change your password and keep your account secure.')}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <label className="space-y-2 text-sm text-text-secondary">
                <span>{t('settings.profile.currentPassword', 'Current Password')}</span>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(event) => handleChange('currentPassword', event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </label>

              <label className="space-y-2 text-sm text-text-secondary">
                <span>{t('settings.profile.newPassword', 'New Password')}</span>
                <input
                  type="password"
                  value={form.newPassword}
                  onChange={(event) => handleChange('newPassword', event.target.value)}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-border bg-bg-surface px-4 py-3 text-text-primary focus:outline-none focus:border-primary disabled:opacity-50"
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="p-6 rounded-3xl border border-border bg-bg-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">{t('settings.profile.quickActions', 'Quick Actions')}</h3>
                <p className="text-sm text-text-secondary">{t('settings.profile.quickActionsDescription', 'Keep your profile up to date for a smoother experience.')}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-text-secondary">
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-subtle text-primary">1</span>
                <span>{t('settings.profile.quickActionName', 'Update your full name')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-subtle text-primary">2</span>
                <span>{t('settings.profile.quickActionEmail', 'Confirm your email address')}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-subtle text-primary">3</span>
                <span>{t('settings.profile.quickActionPassword', 'Change password when needed')}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-border bg-bg-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">{t('settings.profile.languageAndTheme', 'Language & Theme')}</h3>
                <p className="text-sm text-text-secondary">{t('settings.profile.languageDescription', 'Pick your display language and app theme.')}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-text-secondary">
              <p>{t('settings.profile.languageNote', 'Arabic content will display right-to-left when selected.')}</p>
              <p>{t('settings.profile.themeNote', 'Theme changes apply to the application interface.')}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
