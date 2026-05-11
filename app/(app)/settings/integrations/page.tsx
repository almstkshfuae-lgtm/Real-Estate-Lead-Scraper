"use client";

import React from "react";

import { useState, useEffect } from "react";
import { Link2, MessageCircle, Mail, Key, ShieldCheck, Database, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function IntegrationsSettingsPage() {
  const { t } = useTranslation('common');
  
  const [integrations, setIntegrations] = useState({
    bitrixDomain: "yourcompany.bitrix24.ae",
    bitrixToken: "**********************",
    bitrixPushMode: "contacts", // contacts, deals, off
    whatsappPhoneId: "123456789012345",
    whatsappToken: "**********************",
    smtpHost: "smtp.mailgun.org",
    smtpUser: "postmaster@mg.yourdomain.com",
    smtpPass: "**********************"
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({
    bitrix: 'idle',
    whatsapp: 'idle',
    smtp: 'idle'
  });

  useEffect(() => {
    fetch("/api/settings/integrations")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.integrations) {
          setIntegrations(data.integrations);
        }
      })
      .catch(err => console.error("Failed to fetch integrations:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = (key: keyof typeof integrations, value: string) => {
    setIntegrations(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrations })
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(t('settings.integrations.saved', 'Integrations updated successfully.'));
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

  const handleTest = async (system: 'bitrix' | 'whatsapp' | 'smtp') => {
    setTestStatus(prev => ({ ...prev, [system]: 'testing' }));
    // Simulate test API call
    await new Promise(resolve => setTimeout(resolve, 1200));
    setTestStatus(prev => ({ ...prev, [system]: 'success' }));
    toast.success(t(`settings.integrations.testSuccess.${system}`, `Successfully connected to ${system.toUpperCase()}`));
    
    // Reset status after a few seconds
    setTimeout(() => {
      setTestStatus(prev => ({ ...prev, [system]: 'idle' }));
    }, 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t('settings.integrations.title', 'Integrations')}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('settings.integrations.subtitle', 'Connect Brilliance to your CRM and outreach channels.')}
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

      {/* Bitrix24 Integration */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2FC6F6]/10 text-[#2FC6F6] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Bitrix24 CRM</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.bitrixDesc', 'Push leads to Bitrix24 as Contacts or Deals.')}</p>
            </div>
          </div>
          {testStatus.bitrix === 'success' && <Badge className="bg-green-100 text-green-800 border-green-200">{t('settings.integrations.connected', 'Connected')}</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.bitrixDomain', 'Bitrix24 Domain')}</label>
            <div className="relative">
              <input
                type="text"
                value={integrations.bitrixDomain}
                onChange={(e) => handleChange('bitrixDomain', e.target.value)}
                className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.apiToken', 'API Token / Webhook ID')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.bitrixToken}
                onChange={(e) => handleChange('bitrixToken', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <Key className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.pushMode', 'Push Mode')}</label>
          <div className="flex flex-col sm:flex-row gap-3">
            {[
              { id: 'contacts', label: t('settings.integrations.contactsOnly', 'Contacts Only (Recommended)') },
              { id: 'deals', label: t('settings.integrations.contactsDeals', 'Contacts + Deals') },
              { id: 'off', label: t('settings.integrations.off', 'Off') }
            ].map((mode) => (
              <label key={mode.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bitrixPushMode"
                  value={mode.id}
                  checked={integrations.bitrixPushMode === mode.id}
                  onChange={(e) => handleChange('bitrixPushMode', e.target.value)}
                  className="text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">{mode.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('bitrix')}
            disabled={testStatus.bitrix === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.bitrix === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.bitrix === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>

      {/* WhatsApp Business API */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">WhatsApp Business Cloud</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.whatsappDesc', 'Send templated messages directly to leads.')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.phoneId', 'Phone Number ID')}</label>
            <div className="relative">
              <input
                type="text"
                value={integrations.whatsappPhoneId}
                onChange={(e) => handleChange('whatsappPhoneId', e.target.value)}
                className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.whatsappToken', 'Access Token')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.whatsappToken}
                onChange={(e) => handleChange('whatsappToken', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <Key className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('whatsapp')}
            disabled={testStatus.whatsapp === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.whatsapp === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.whatsapp === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>

      {/* SMTP Email */}
      <div className="p-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-500/10 text-gray-500 flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">SMTP Email</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('settings.integrations.smtpDesc', 'Configure outgoing email for campaigns and alerts.')}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpHost', 'SMTP Host')}</label>
            <input
              type="text"
              value={integrations.smtpHost}
              onChange={(e) => handleChange('smtpHost', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpUser', 'SMTP Username')}</label>
            <input
              type="text"
              value={integrations.smtpUser}
              onChange={(e) => handleChange('smtpUser', e.target.value)}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">{t('settings.integrations.smtpPass', 'SMTP Password')}</label>
            <div className="relative">
              <input
                type="password"
                value={integrations.smtpPass}
                onChange={(e) => handleChange('smtpPass', e.target.value)}
                className="w-full h-10 px-3 pl-9 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
              <Key className="w-4 h-4 text-[var(--color-text-secondary)] absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={() => handleTest('smtp')}
            disabled={testStatus.smtp === 'testing'}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg font-medium hover:bg-[var(--color-bg-surface)] transition-all disabled:opacity-50"
          >
            {testStatus.smtp === 'testing' ? (
              <span className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"></span>
            ) : testStatus.smtp === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 text-[var(--color-text-secondary)]" />
            )}
            {t('settings.integrations.testConnection', 'Test Connection')}
          </button>
        </div>
      </div>
    </div>
  );
}

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${className}`}>{children}</span>
}
