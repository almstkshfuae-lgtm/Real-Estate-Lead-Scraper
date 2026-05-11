"use client";

import { 
  X, 
  Phone, 
  Mail, 
  Building2, 
  Briefcase, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Copy,
  CheckCircle2,
  Clock,
  Send
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ScoreBadge, { TierBadge, SignalChip } from "./ScoreBadge";
import { Lead } from "./LeadTable";

export default function LeadSidebar({ lead, onClose }: { lead: Lead | null, onClose: () => void }) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'ai' | 'notes'>('details');

  if (!lead) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const tabs = [
    { id: 'details', label: t('leads.sidebar.tabs.details'), icon: Briefcase },
    { id: 'ai', label: t('leads.sidebar.tabs.ai'), icon: Sparkles },
    { id: 'notes', label: t('leads.sidebar.tabs.notes'), icon: MessageSquare },
  ];

  return (
    <div className="fixed inset-y-0 inset-inline-end-0 w-full sm:max-w-md bg-[var(--color-bg-card)] shadow-2xl border-inline-start border-[var(--color-border)] z-50 flex flex-col transition-all duration-300 animate-in slide-in-from-inline-end">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-surface)]/50">
        <div className="flex items-center gap-3">
          <ScoreBadge score={lead.score} />
          <div className="text-start">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <TierBadge tier={lead.tier} />
              <span className="text-xs text-[var(--color-text-disabled)]">•</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t(`leads.status.${lead.status}`, lead.status)}</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all border-b-2 ${
              activeTab === tab.id 
                ? "border-[var(--color-primary)] text-[var(--color-primary)]" 
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {activeTab === 'details' && (
          <div className="space-y-8">
            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">
                {t('leads.sidebar.contact')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[var(--color-primary)] flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{lead.phone || t('common.notAvailable')}</span>
                  </div>
                  {lead.phone && (
                    <button 
                      onClick={() => copyToClipboard(lead.phone!, "phone")}
                      className="p-1.5 rounded-md hover:bg-white text-[var(--color-text-disabled)] hover:text-[var(--color-primary)] transition-all"
                    >
                      {copied === 'phone' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{lead.email || t('common.notAvailable')}</span>
                  </div>
                  {lead.email && (
                    <button 
                      onClick={() => copyToClipboard(lead.email!, "email")}
                      className="p-1.5 rounded-md hover:bg-white text-[var(--color-text-disabled)] hover:text-[var(--color-primary)] transition-all"
                    >
                      {copied === 'email' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">
                {t('leads.sidebar.professional')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                  <Building2 className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t('leads.sidebar.company', 'Company')}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{lead.company}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                  <Briefcase className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t('leads.sidebar.role', 'Role')}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{lead.role}</p>
                </div>
              </div>
            </div>

            {/* Intelligence Signals */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">
                {t('leads.sidebar.signals')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {(lead.signals as string[]).map((s: string, i: number) => (
                  <SignalChip key={i} signal={s} />
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-start">
                <div className="flex gap-3">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>{t('leads.sidebar.recentActivity')}:</strong> Mentioned in Bloomberg MENA regarding a new investment fund launch in DIFC. Potential high liquidity event.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-6 text-start">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 text-white relative overflow-hidden">
              <div className="absolute -inline-end-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
              <Sparkles className="w-6 h-6 mb-4 text-blue-200" />
              <h3 className="text-lg font-bold mb-2">{t('leads.sidebar.aiPitch.title')}</h3>
              <p className="text-sm text-blue-100 leading-relaxed">
                {t('leads.sidebar.aiPitch.subtitle', { name: lead.name.split(' ')[0] })}
              </p>
            </div>
            
            <div className="space-y-4 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
              <p className="text-sm text-[var(--color-text-primary)] leading-relaxed font-medium italic">
                "{t('leads.sidebar.aiPitch.template', { name: lead.name, company: lead.company })}"
              </p>
              <div className="flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border border-[var(--color-border)] rounded-xl text-xs font-bold hover:bg-gray-50 transition-all">
                  <Copy className="w-3 h-3" /> {t('leads.sidebar.aiPitch.copy')}
                </button>
                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-all">
                  <Send className="w-3 h-3" /> {t('leads.sidebar.aiPitch.whatsapp')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6 text-start">
            <div className="space-y-4">
              <textarea 
                className="w-full h-40 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
                placeholder={t('leads.sidebar.notes.placeholder')}
              ></textarea>
              <button className="w-full py-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-bold rounded-xl hover:bg-[var(--color-bg-surface)] transition-all">
                {t('leads.sidebar.notes.save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 flex gap-3">
        <button className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2">
          {t('leads.sidebar.actions.bitrix')}
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
