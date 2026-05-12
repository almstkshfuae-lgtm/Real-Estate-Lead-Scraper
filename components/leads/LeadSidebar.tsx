"use client";

import {
  X, Phone, Mail, Building2, Briefcase, ExternalLink,
  MessageSquare, Sparkles, Copy, CheckCircle2, Clock,
  Send, Loader2, Zap, TrendingUp, RefreshCw, Brain, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import ScoreBadge, { TierBadge, SignalChip } from "./ScoreBadge";
import { Lead } from "./LeadTable";

export default function LeadSidebar({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language === "ar" ? "ar" : "en";

  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "ai" | "notes">("details");
  const [notes, setNotes] = useState(lead?.notes || "");
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  // AI Pitch state
  const [pitch, setPitch] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchStyle, setPitchStyle] = useState<"professional" | "formal" | "casual">("professional");

  // Score refinement state
  const [scoreResult, setScoreResult] = useState<{
    refinedScore: number; delta: number; reasoning: string; recommendations: string[];
  } | null>(null);
  const [scoringLoading, setScoringLoading] = useState(false);

  // Signals state
  const [signals, setSignals] = useState<{
    extractedSignals: string[]; summary: string; confidenceScore: number; newsSnippets: string[];
  } | null>(null);
  const [signalsLoading, setSignalsLoading] = useState(false);

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
      setPitch("");
      setScoreResult(null);
      setSignals(null);
    }
  }, [lead]);

  if (!lead) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const generatePitch = async () => {
    setPitchLoading(true);
    setPitch("");
    try {
      const res = await fetch("/api/ai/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, lang, style: pitchStyle }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPitch(data.pitch);
    } catch (err: any) {
      toast.error(t("ai.pitchError", "Failed to generate pitch"));
    } finally {
      setPitchLoading(false);
    }
  };

  const refineScore = async () => {
    setScoringLoading(true);
    try {
      const res = await fetch("/api/ai/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setScoreResult(data);
      toast.success(t("ai.scoreRefined", "Score refined by AI"));
    } catch (err: any) {
      toast.error(t("ai.scoreError", "Failed to refine score"));
    } finally {
      setScoringLoading(false);
    }
  };

  const extractSignals = async () => {
    setSignalsLoading(true);
    try {
      const res = await fetch("/api/ai/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead, lang }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignals(data);
      toast.success(t("ai.signalsExtracted", "Signals extracted"));
    } catch (err: any) {
      toast.error(t("ai.signalsError", "Failed to extract signals"));
    } finally {
      setSignalsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('common.confirmDeleteSingle', { name: lead.name, defaultValue: `Are you sure you want to delete ${lead.name}?` }))) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete lead");
      }
      
      toast.success(t('common.deleted', { name: lead.name, defaultValue: "Lead deleted successfully" }));
      onClose();
      // We should probably trigger a refresh of the leads list here, 
      // but since we don't have a global state, we'll rely on the user refreshing or the next fetch.
      window.location.reload(); 
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "details", label: t("leads.sidebar.tabs.details"), icon: Briefcase },
    { id: "ai", label: t("leads.sidebar.tabs.ai"), icon: Sparkles },
    { id: "notes", label: t("leads.sidebar.tabs.notes"), icon: MessageSquare },
  ];

  const currentScore = scoreResult?.refinedScore ?? lead.score;

  return (
    <div className="fixed inset-y-0 inset-inline-end-0 w-full sm:max-w-md bg-[var(--color-bg-card)] shadow-2xl border-inline-start border-[var(--color-border)] z-50 flex flex-col transition-all duration-300 animate-in slide-in-from-inline-end">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-surface)]/50">
        <div className="flex items-center gap-3">
          <ScoreBadge score={currentScore} />
          <div className="text-start">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{lead.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <TierBadge tier={lead.tier} />
              <span className="text-xs text-[var(--color-text-disabled)]">•</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
                {t(`leads.status.${lead.status}`, lead.status)}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors">
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* DETAILS TAB */}
        {activeTab === "details" && (
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.contact")}</h3>
              {[
                { icon: Phone, value: lead.phone, label: "phone", bg: "bg-blue-50 text-[var(--color-primary)]" },
                { icon: Mail, value: lead.email, label: "email", bg: "bg-purple-50 text-purple-600" },
              ].map(({ icon: Icon, value, label, bg }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{value || t("common.notAvailable")}</span>
                  </div>
                  {value && (
                    <button onClick={() => copyToClipboard(value, label)} className="p-1.5 rounded-md hover:bg-[var(--color-bg-card)] text-[var(--color-text-disabled)] hover:text-[var(--color-primary)] transition-all">
                      {copied === label ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Professional */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.professional")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                  <Building2 className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("leads.sidebar.company")}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{lead.company}</p>
                </div>
                <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                  <Briefcase className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("leads.sidebar.role")}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{lead.role}</p>
                </div>
              </div>
            </div>

            {/* Signals */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.signals")}</h3>
              <div className="flex flex-wrap gap-2">
                {(lead.signals as string[]).map((s: string, i: number) => <SignalChip key={i} signal={s} />)}
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-start">
                <div className="flex gap-3">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong>{t("leads.sidebar.recentActivity")}:</strong>{" "}
                    {t("leads.sidebar.recentActivityText", { company: lead.company })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI TAB */}
        {activeTab === "ai" && (
          <div className="space-y-5 text-start">

            {/* Section 1: AI Pitch Generator */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 text-white relative overflow-hidden">
              <div className="absolute -inset-x-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <Sparkles className="w-5 h-5 mb-3 text-blue-200" />
              <h3 className="text-base font-bold mb-1">{t("ai.pitchTitle", "AI Pitch Generator")}</h3>
              <p className="text-xs text-blue-100">{t("ai.pitchSubtitle", "Claude generates a personalized pitch for this lead")}</p>
            </div>

            {/* Style selector */}
            <div className="flex gap-2">
              {(["professional", "formal", "casual"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPitchStyle(s)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                    pitchStyle === s
                      ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                      : "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t(`ai.style.${s}`, s)}
                </button>
              ))}
            </div>

            <button
              onClick={generatePitch}
              disabled={pitchLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-60"
            >
              {pitchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {pitchLoading ? t("ai.generating", "Generating...") : t("ai.generatePitch", "Generate AI Pitch")}
            </button>

            {pitch && (
              <div className="space-y-3 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">&ldquo;{pitch}&rdquo;</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(pitch, "pitch")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-xs font-bold hover:bg-[var(--color-bg-surface)] transition-all"
                  >
                    {copied === "pitch" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {t("leads.sidebar.aiPitch.copy")}
                  </button>
                  <button 
                    onClick={async () => {
                      if (!pitch) return;
                      const toastId = toast.loading(t("common.sending", "Sending..."));
                      try {
                        const res = await fetch(`/api/leads/${lead.id}/whatsapp`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text: pitch })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to send");
                        toast.success(t("common.whatsappSent", "WhatsApp message sent"), { id: toastId });
                      } catch (err: any) {
                        toast.error(err.message, { id: toastId });
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#25D366] text-white rounded-xl text-xs font-bold hover:bg-[#128C7E] transition-all"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {t("leads.sidebar.aiPitch.whatsapp")}
                  </button>
                  <button 
                    onClick={async () => {
                      if (!pitch) return;
                      const toastId = toast.loading(t("common.sending", "Sending..."));
                      try {
                        const res = await fetch(`/api/leads/${lead.id}/email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ 
                            subject: `Investment Opportunity: ${lead.company}`,
                            body: pitch 
                          })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to send");
                        toast.success(t("common.emailSent", "Email sent successfully"), { id: toastId });
                      } catch (err: any) {
                        toast.error(err.message, { id: toastId });
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-all"
                  >
                    <Mail className="w-3 h-3" />
                    {t("leads.sidebar.aiPitch.email")}
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-[var(--color-border)]" />

            {/* Section 2: Score Refinement */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{t("ai.refineScore", "AI Score Refinement")}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("ai.refineScoreDesc", "Claude re-evaluates lead quality")}</p>
                </div>
                <button
                  onClick={refineScore}
                  disabled={scoringLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-60"
                >
                  {scoringLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
                  {t("ai.analyzeBtn", "Analyze")}
                </button>
              </div>
              {scoreResult && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/20 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{scoreResult.refinedScore}</div>
                    <div>
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {scoreResult.delta > 0 ? `+${scoreResult.delta}` : scoreResult.delta} {t("ai.scoreDelta", "from original")}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-300">{scoreResult.reasoning}</p>
                    </div>
                  </div>
                  {scoreResult.recommendations?.length > 0 && (
                    <div className="space-y-1">
                      {scoreResult.recommendations.map((r, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                          <Zap className="w-3 h-3 mt-0.5 shrink-0" />
                          {r}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--color-border)]" />

            {/* Section 3: Signal Extraction */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{t("ai.signals", "Signal Extraction")}</h4>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("ai.signalsDesc", "Extract investment signals from news")}</p>
                </div>
                <button
                  onClick={extractSignals}
                  disabled={signalsLoading}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-all disabled:opacity-60"
                >
                  {signalsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {t("ai.scanBtn", "Scan")}
                </button>
              </div>
              {signals && (
                <div className="p-4 rounded-xl border border-violet-200 bg-violet-50 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {signals.extractedSignals.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-bold">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-violet-900 leading-relaxed">{signals.summary}</p>
                  <p className="text-[10px] text-violet-500">{t("ai.confidence", "Confidence")}: {signals.confidenceScore}%</p>
                  <div className="space-y-1 pt-1 border-t border-violet-200">
                    {signals.newsSnippets.map((s, i) => (
                      <p key={i} className="text-[10px] text-violet-700 leading-relaxed">• {s}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {activeTab === "notes" && (
          <div className="space-y-4 text-start">
            <textarea
              className="w-full h-40 p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
              placeholder={t("leads.sidebar.notes.placeholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <button
              onClick={async () => {
                setSaving(true);
                try {
                  await fetch(`/api/leads/${lead.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notes }),
                  });
                  toast.success(t("leads.sidebar.notes.saved"));
                } catch { /* noop */ } finally { setSaving(false); }
              }}
              disabled={saving}
              className="w-full py-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-bold rounded-xl hover:bg-[var(--color-bg-surface)] transition-all flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("leads.sidebar.notes.save")}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 flex gap-3">
        <button
          onClick={handleDelete}
          disabled={saving || pushing}
          className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-100 dark:border-red-900/30 disabled:opacity-50"
          title={t('common.delete')}
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button
          onClick={async () => {
            setPushing(true);
            try {
              const res = await fetch(`/api/leads/${lead.id}/push`, { method: "POST" });
              const data = await res.json();
              
              if (!res.ok) throw new Error(data.error || "Failed to push");
              
              toast.success(t("common.pushedToBitrix", "Pushed to Bitrix24 successfully"));
              // Optionally update lead object locally if we want to show bitrix24Id
            } catch (err: any) {
              toast.error(err.message);
            } finally {
              setPushing(false);
            }
          }}
          disabled={pushing || saving}
          className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
          {t("leads.sidebar.actions.bitrix")}
        </button>
      </div>
    </div>
  );
}
