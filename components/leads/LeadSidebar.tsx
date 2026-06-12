"use client";

import {
  X, Phone, Mail, Building2, Briefcase, ExternalLink,
  MessageSquare, Sparkles, Copy, CheckCircle2, Clock,
  Send, Loader2, Zap, TrendingUp, RefreshCw, Brain, Trash2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { isAdmin } from "@/lib/roles";
import { toast } from "sonner";
import ScoreBadge, { TierBadge, SignalChip } from "./ScoreBadge";
import { Lead } from "./LeadTable";
import { safeJson } from "@/lib/safe-fetch";

export default function LeadSidebar({ lead: initialLead, userRole, onClose, onUpdate }: { lead: Lead | null; userRole?: string; onClose: () => void; onUpdate?: (updatedLead?: Lead) => void }) {
  const { t, i18n } = useTranslation("common");
  const lang = i18n.language === "ar" ? "ar" : "en";
  const isAdminUser = isAdmin(userRole);

  const [lead, setLead] = useState<Lead | null>(initialLead);
  const [loadingLead, setLoadingLead] = useState(false);

  const translateError = (message: string) => {
    if (!message) return "";
    if (message.includes("Only admins are allowed to edit")) {
      return t("errors.onlyAdminsEdit", "Only admins are allowed to edit lead details.");
    }
    return message;
  };

  const [copied, setCopied] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "ai" | "notes" | "followup">("details");
  const [notes, setNotes] = useState(initialLead?.notes || "");
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

  // Follow-up state
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDesc, setFollowUpDesc] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const [dynamicPersona, setDynamicPersona] = useState<string | null>(null);
  const [personaLoading, setPersonaLoading] = useState(false);

  // Lead Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    location: "",
    score: 50,
    budgetMin: "",
    budgetMax: "",
    tier: 3,
    source: "",
    signals: "",
  });

  useEffect(() => {
    let active = true;
    if (initialLead) {
      setNotes(initialLead.notes || "");
      setPitch("");
      setScoreResult(null);
      setSignals(null);
      setDynamicPersona(null);

      setEditForm({
        name: initialLead.name || "",
        email: initialLead.email || "",
        phone: initialLead.phone || "",
        company: initialLead.company || "",
        role: initialLead.role || "",
        location: initialLead.location || "",
        score: initialLead.score ?? 50,
        budgetMin: initialLead.budgetMin?.toString() || "",
        budgetMax: initialLead.budgetMax?.toString() || "",
        tier: initialLead.tier ?? 3,
        source: initialLead.source || "",
        signals: Array.isArray(initialLead.signals) ? initialLead.signals.join(", ") : "",
      });
      setIsEditing(false);
      setLead(initialLead);

      const fetchFullLead = async () => {
        setLoadingLead(true);
        try {
          const res = await fetch(`/api/leads/${initialLead.id}`);
          if (!res.ok) throw new Error("Failed to fetch full lead");
          const data = await res.json();
          if (active && data.lead) {
            setLead(data.lead);
            setNotes(data.lead.notes || "");
            setEditForm({
              name: data.lead.name || "",
              email: data.lead.email || "",
              phone: data.lead.phone || "",
              company: data.lead.company || "",
              role: data.lead.role || "",
              location: data.lead.location || "",
              score: data.lead.score ?? 50,
              budgetMin: data.lead.budgetMin?.toString() || "",
              budgetMax: data.lead.budgetMax?.toString() || "",
              tier: data.lead.tier ?? 3,
              source: data.lead.source || "",
              signals: Array.isArray(data.lead.signals) ? data.lead.signals.join(", ") : "",
            });
          }
        } catch (err) {
          console.error("Error fetching full lead details:", err);
        } finally {
          if (active) setLoadingLead(false);
        }
      };

      fetchFullLead();

      // Load cached/stored persona
      setPersonaLoading(true);
      fetch(`/api/leads/${initialLead.id}/persona?lang=${lang}`)
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          if (active && data && data.persona) {
            setDynamicPersona(data.persona);
          }
        })
        .catch((err) => {
          console.error("Failed to load persona:", err);
        })
        .finally(() => {
          if (active) {
            setPersonaLoading(false);
          }
        });

      // Load cached signals
      fetch("/api/ai/signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: initialLead.id, generate: false, lang })
      })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (active && data && data.summary) {
          setSignals(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load cached signals:", err);
      });
    } else {
      setLead(null);
    }
    return () => {
      active = false;
    };
  }, [initialLead, lang]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setSaving(true);
    try {
      const signalsArray = editForm.signals
        ? editForm.signals.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      
      const payload: any = {};
      if (editForm.name !== lead.name) payload.name = editForm.name;
      if (editForm.email !== lead.email) payload.email = editForm.email || null;
      if (editForm.phone !== lead.phone) payload.phone = editForm.phone || null;
      if (editForm.company !== lead.company) payload.company = editForm.company;
      if (editForm.role !== lead.role) payload.role = editForm.role;
      if (editForm.location !== lead.location) payload.location = editForm.location;
      if (editForm.score !== lead.score) payload.score = editForm.score;
      if (editForm.source !== lead.source) payload.source = editForm.source;
      
      const rawBudgetMin = String(editForm.budgetMin || "").trim();
      const budgetMinVal = rawBudgetMin !== "" ? parseFloat(rawBudgetMin.replace(/,/g, "")) : null;
      const finalBudgetMinVal = (budgetMinVal === null || isNaN(budgetMinVal)) ? null : budgetMinVal;
      if (finalBudgetMinVal !== lead.budgetMin) payload.budgetMin = finalBudgetMinVal;
      
      const rawBudgetMax = String(editForm.budgetMax || "").trim();
      const budgetMaxVal = rawBudgetMax !== "" ? parseFloat(rawBudgetMax.replace(/,/g, "")) : null;
      const finalBudgetMaxVal = (budgetMaxVal === null || isNaN(budgetMaxVal)) ? null : budgetMaxVal;
      if (finalBudgetMaxVal !== lead.budgetMax) payload.budgetMax = finalBudgetMaxVal;

      if (editForm.tier !== lead.tier) payload.tier = editForm.tier;

      const currentSignals = Array.isArray(lead.signals) ? lead.signals : [];
      const signalsChanged = signalsArray.length !== currentSignals.length || 
        signalsArray.some((sig, idx) => sig !== currentSignals[idx]);
      if (signalsChanged) payload.signals = signalsArray;

      if (Object.keys(payload).length === 0) {
        setIsEditing(false);
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || "Failed to update lead");
      }

      const data = await safeJson(res);
      const updatedLead = data.lead;

      toast.success(t("common.saved", "Lead updated successfully"));
      setIsEditing(false);
      if (onUpdate) {
        onUpdate(updatedLead);
      }
    } catch (err: any) {
      toast.error(translateError(err.message));
    } finally {
      setSaving(false);
    }
  };

  if (!lead) return null;

  const formatBilingualWhatsApp = (text: string, isArabic: boolean): string => {
    if (!text) return "";
    if (!isArabic) return text;

    const RLM = "\u200F";
    const LRM = "\u200E";

    let formatted = text;

    // 1. Wrap URLs in LRM and RLM marks
    const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    formatted = formatted.replace(urlPattern, (match) => `${LRM}${match}${RLM}`);

    // 2. Wrap pricing / currency blocks (e.g. AED 5,000,000 or 5,000,000 AED)
    const currencyPattern = /(AED\s*\d+[\d,.]*|\d+[\d,.]*\s*AED)/gi;
    formatted = formatted.replace(currencyPattern, (match) => `${LRM}${match}${RLM}`);

    // 3. Wrap phone numbers (e.g. +971...)
    const phonePattern = /(\+?\d[\d\s-]{7,}\d)/g;
    formatted = formatted.replace(phonePattern, (match) => `${LRM}${match}${RLM}`);

    // 4. Wrap percentages and statistics (e.g. 10% or 5 beds or 500 sqft)
    const statsPattern = /(\b\d+[\d,.]*\s*(?:%|beds?|sqft|sq\s*m)\b)/gi;
    formatted = formatted.replace(statsPattern, (match) => `${LRM}${match}${RLM}`);

    return formatted;
  };

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
      const data = await safeJson(res);
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
        body: JSON.stringify({ leadId: lead.id, generate: true, lang }),
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

  const generatePersona = async () => {
    setPersonaLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/persona?lang=${lang}&generate=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.persona) {
        setDynamicPersona(data.persona);
        toast.success(t("ai.personaGenerated", "Persona profile generated successfully"));
      } else {
        throw new Error("Empty response");
      }
    } catch (err: any) {
      toast.error(t("ai.personaError", "Failed to generate persona"));
    } finally {
      setPersonaLoading(false);
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
        const data = await safeJson(res).catch(() => ({} as any));
        throw new Error(data.error || "Failed to delete lead");
      }

      toast.success(t('common.deleted', { name: lead.name, defaultValue: "Lead deleted successfully" }));
      onClose();
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      toast.error(translateError(err.message));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "details", label: t("leads.sidebar.tabs.details"), icon: Briefcase },
    { id: "ai", label: t("leads.sidebar.tabs.ai"), icon: Sparkles },
    { id: "notes", label: t("leads.sidebar.tabs.notes"), icon: MessageSquare },
    { id: "followup", label: t("leads.sidebar.tabs.followup", "Follow-up"), icon: Clock },
  ];

  const displayName = (lang === "ar" && lead.nameAr) ? lead.nameAr : lead.name;
  const currentScore = scoreResult?.refinedScore ?? lead.score;

  return (
    <div className="fixed inset-y-0 inset-inline-end-0 w-full sm:max-w-md bg-[var(--color-bg-card)] shadow-2xl border-inline-start border-[var(--color-border)] z-[1000] flex flex-col transition-all duration-300 animate-in slide-in-from-inline-end">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-surface)]/50">
        <div className="flex items-center gap-3">
          <ScoreBadge score={currentScore} />
          <div className="text-start">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{displayName}</h2>
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
            className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium transition-all border-b-2 ${activeTab === tab.id
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
      <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
        {loadingLead && (
          <div className="absolute inset-0 bg-[var(--color-bg-card)]/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">
              {t("common.loading", "Loading secure details...")}
            </span>
          </div>
        )}

        {/* DETAILS TAB */}
        {activeTab === "details" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-border)]/50 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)]">{t("leads.sidebar.contact")}</h3>
              {isAdminUser && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                >
                  {isEditing ? t("common.cancel", "Cancel") : t("common.edit", "Edit")}
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.name", "Name")}</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.phone", "Phone")}</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.email", "Email")}</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.company", "Company")}</label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.role", "Role")}</label>
                    <input
                      type="text"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5 text-start col-span-2">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.location", "Location")}</label>
                    <input
                      type="text"
                      value={editForm.location}
                      onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.score", "Score")}</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.score}
                      onChange={(e) => setEditForm({ ...editForm, score: parseInt(e.target.value, 10) || 0 })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.tier", "Tier")}</label>
                    <select
                      value={editForm.tier}
                      onChange={(e) => setEditForm({ ...editForm, tier: parseInt(e.target.value, 10) })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    >
                      <option value={1}>{t("leads.tiers.t1", "T1 — Elite")}</option>
                      <option value={2}>{t("leads.tiers.t2", "T2 — Premium")}</option>
                      <option value={3}>{t("leads.tiers.t3", "T3 — Standard")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.source", "Source")}</label>
                    <input
                      type="text"
                      value={editForm.source}
                      onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.budgetMin", "Min Budget (AED)")}</label>
                    <input
                      type="number"
                      value={editForm.budgetMin}
                      onChange={(e) => setEditForm({ ...editForm, budgetMin: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 text-start">
                    <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.budgetMax", "Max Budget (AED)")}</label>
                    <input
                      type="number"
                      value={editForm.budgetMax}
                      onChange={(e) => setEditForm({ ...editForm, budgetMax: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 text-start">
                  <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.signals", "Signals (comma separated)")}</label>
                  <input
                    type="text"
                    value={editForm.signals}
                    onChange={(e) => setEditForm({ ...editForm, signals: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    placeholder={t("leads.sidebar.signalsPlaceholder", "e.g. UHNW, Investor, Executive")}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("common.save", "Save Changes")}
                </button>
              </form>
            ) : (
              <>
                {/* Contact Info */}
                <div className="space-y-3">
                  {[
                    { icon: Phone, value: lead.phone, label: "phone", bg: "bg-blue-50 text-[var(--color-primary)]" },
                    { icon: Mail, value: lead.email, label: "email", bg: "bg-purple-50 text-purple-600" },
                  ].map(({ icon: Icon, value, label, bg }) => (
                    <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}><Icon className="w-4 h-4" /></div>
                        <span dir="ltr" className="text-sm font-medium text-[var(--color-text-primary)] inline-block text-start text-left">{value || t("common.notAvailable")}</span>
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
                      <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
                        {(lang === "ar" && lead.companyAr) ? lead.companyAr : lead.company}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                      <Briefcase className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                      <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("leads.sidebar.role")}</p>
                      <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">
                        {(lang === "ar" && lead.roleAr) ? lead.roleAr : lead.role}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Budget */}
                {(lead.budgetMin || lead.budgetMax) && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.budget", "Budget")}</h3>
                    <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {lead.budgetMin 
                          ? (lang === "ar" ? `${lead.budgetMin.toLocaleString()} د.إ` : `AED ${lead.budgetMin.toLocaleString()}`) 
                          : "0"} - {lead.budgetMax 
                            ? (lang === "ar" ? `${lead.budgetMax.toLocaleString()} د.إ` : `AED ${lead.budgetMax.toLocaleString()}`) 
                            : t("common.any", "Any")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Metadata (Unstructured CSV extra data) */}
                {lead.metadata && typeof lead.metadata === 'object' && Object.keys(lead.metadata as Record<string, any>).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.additionalData", "Additional Data")}</h3>
                    <div className="p-4 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start space-y-2">
                      {Object.entries(lead.metadata as Record<string, any>).map(([key, val]) => (
                        <div key={key} className="flex justify-between text-xs border-b border-[var(--color-border)]/50 pb-1.5 last:border-0 last:pb-0">
                          <span className="font-bold text-[var(--color-text-secondary)]">{key}:</span>
                          <span className="text-[var(--color-text-primary)] truncate max-w-[200px]" title={String(val)}>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Signals */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-disabled)] text-start">{t("leads.sidebar.signals")}</h3>
                  <div className="flex flex-wrap gap-2">
                    {((lead.signals || []) as string[])
                      .filter(s => s !== "Manual Import")
                      .map((s: string, i: number) => <SignalChip key={i} signal={s} />)}
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 text-start">
                    <div className="flex gap-3">
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed w-full">
                        <strong className="block mb-1">{t("leads.sidebar.recentActivity")}:</strong>{" "}
                        {personaLoading ? (
                          <span className="flex items-center gap-1.5 text-amber-600/70 dark:text-amber-400/70 font-medium">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {t("ai.generating", "Generating...")}
                          </span>
                        ) : dynamicPersona ? (
                          <span>{dynamicPersona}</span>
                        ) : (
                          <div className="mt-1 flex flex-col gap-2">
                            <span className="text-amber-700 dark:text-amber-400 italic">
                              {t("ai.noPersona", "No investor persona profile has been generated yet for this lead.")}
                            </span>
                            <button
                              type="button"
                              onClick={generatePersona}
                              disabled={personaLoading}
                              className="text-xs font-bold text-amber-900 dark:text-amber-200 hover:underline self-start flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-md transition-all disabled:opacity-60"
                            >
                              <Sparkles className="w-3 h-3" />
                              {t("ai.generatePersonaBtn", "Generate Persona Profile")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* AI TAB */}
        {activeTab === "ai" && (
          <div className="space-y-5 text-start">

            {/* Persona Analysis Section */}
            {(dynamicPersona || personaLoading) ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{t("ai.personaAnalysis", "Persona Analysis")}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("ai.personaDesc", "Comprehensive AI profile analysis")}</p>
                  </div>
                  {dynamicPersona && (
                    <button
                      onClick={generatePersona}
                      disabled={personaLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-60"
                    >
                      {personaLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {t("common.regenerate", "Regenerate")}
                    </button>
                  )}
                </div>
                {personaLoading ? (
                  <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm flex items-center justify-center gap-2 py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
                    <span className="text-[var(--color-text-secondary)]">{t("ai.generating", "Generating...")}</span>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                    {dynamicPersona}
                  </div>
                )}
                <div className="border-t border-[var(--color-border)] mt-5" />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{t("ai.personaAnalysis", "Persona Analysis")}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)]">{t("ai.personaDesc", "Comprehensive AI profile analysis")}</p>
                  </div>
                </div>
                <div className="p-6 rounded-xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center space-y-3">
                  <Brain className="w-8 h-8 text-[var(--color-text-disabled)]" />
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{t("ai.noPersonaTitle", "No Persona Profile Yet")}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] max-w-xs mt-1">
                      {t("ai.noPersonaDesc", "Analyze the lead's company and background to construct their investor persona.")}
                    </p>
                  </div>
                  <button
                    onClick={generatePersona}
                    disabled={personaLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60"
                  >
                    {personaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t("ai.generatePersonaBtn", "Generate Persona Profile")}
                  </button>
                </div>
                <div className="border-t border-[var(--color-border)] mt-5" />
              </div>
            )}

            {/* Section 1: AI Pitch Generator */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 text-white relative overflow-hidden">
              <div className="absolute -inset-x-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <Sparkles className="w-5 h-5 mb-3 text-blue-200" />
              <h3 className="text-base font-bold mb-1">{t("ai.pitchTitle", "AI Pitch Generator")}</h3>
              <p className="text-xs text-blue-100">{t("ai.pitchSubtitle", "Gemini generates a personalized pitch for this lead")}</p>
            </div>

            {/* Style selector */}
            <div className="flex gap-2">
              {(["professional", "formal", "casual"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setPitchStyle(s)}
                  className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${pitchStyle === s
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
                    onClick={() => copyToClipboard(formatBilingualWhatsApp(pitch, lang === "ar"), "pitch")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-xs font-bold hover:bg-[var(--color-bg-surface)] transition-all"
                  >
                    {copied === "pitch" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {t("leads.sidebar.aiPitch.copy")}
                  </button>
                  <button
                    onClick={async () => {
                      if (!pitch) return;
                      const formattedPitch = formatBilingualWhatsApp(pitch, lang === "ar");
                      const toastId = toast.loading(t("common.sending", "Sending..."));
                      try {
                        const res = await fetch(`/api/leads/${lead.id}/whatsapp`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text: formattedPitch })
                        });
                        const data = await safeJson(res);
                        if (!res.ok) throw new Error(data.error || "Failed to send");
                        toast.success(t("common.whatsappSent", "WhatsApp message sent"), { id: toastId });
                      } catch (err: any) {
                        toast.error(translateError(err.message), { id: toastId });
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
                            subject: lang === "ar" 
                              ? `فرصة استثمارية: ${(lang === "ar" && lead.companyAr) ? lead.companyAr : lead.company}` 
                              : `Investment Opportunity: ${lead.company}`,
                            body: pitch
                          })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to send");
                        toast.success(t("common.emailSent", "Email sent successfully"), { id: toastId });
                      } catch (err: any) {
                        toast.error(translateError(err.message), { id: toastId });
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
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("ai.refineScoreDesc", "Gemini re-evaluates lead quality")}</p>
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
              {signals ? (
                <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-900/30 bg-violet-50 dark:bg-violet-900/20 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {signals.extractedSignals.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-300 text-[10px] font-bold">{s}</span>
                    ))}
                  </div>
                  <p className="text-xs text-violet-950 dark:text-violet-200 leading-relaxed">{signals.summary}</p>
                  <p className="text-[10px] text-violet-500">{t("ai.confidence", "Confidence")}: {signals.confidenceScore}%</p>
                  {signals.newsSnippets?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-violet-200 dark:border-violet-900/30">
                      {signals.newsSnippets.map((s, i) => (
                        <p key={i} className="text-[10px] text-violet-700 dark:text-violet-300 leading-relaxed">• {s}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 rounded-xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center text-center space-y-2 bg-[var(--color-bg-surface)]/20">
                  <TrendingUp className="w-6 h-6 text-[var(--color-text-disabled)]" />
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("ai.noSignalsDesc", "No intelligence signals scanned yet. Click Scan to search for relevant news and indicators.")}
                  </p>
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

        {/* FOLLOWUP TAB */}
        {activeTab === "followup" && (
          <div className="space-y-4 text-start">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-blue-700 text-white relative overflow-hidden">
              <div className="absolute -inset-x-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <Clock className="w-5 h-5 mb-3 text-blue-200" />
              <h3 className="text-base font-bold mb-1">{t("leads.sidebar.followup.title", "Schedule Follow-up")}</h3>
              <p className="text-xs text-blue-100">{t("leads.sidebar.followup.subtitle", "Syncs directly to your Bitrix24 Calendar")}</p>
            </div>

            {!lead.bitrix24Id ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 rounded-xl text-sm font-medium">
                {t("leads.sidebar.followup.needsPush", "Please push this lead to Bitrix24 first before scheduling a follow-up.")}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={t("leads.sidebar.followup.eventTitle", "Event Title")}
                  className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                  value={followUpTitle}
                  onChange={(e) => setFollowUpTitle(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                  />
                  <input
                    type="time"
                    className="w-full p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                    value={followUpTime}
                    onChange={(e) => setFollowUpTime(e.target.value)}
                  />
                </div>

                <textarea
                  className="w-full h-24 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
                  placeholder={t("leads.sidebar.followup.description", "Description (optional)")}
                  value={followUpDesc}
                  onChange={(e) => setFollowUpDesc(e.target.value)}
                />

                <button
                  onClick={async () => {
                    if (!followUpDate || !followUpTime) {
                      toast.error(t("leads.sidebar.followup.missingDate", "Please select a date and time"));
                      return;
                    }

                    setScheduling(true);
                    try {
                      const start = new Date(`${followUpDate}T${followUpTime}`);
                      const end = new Date(start.getTime() + 60 * 60 * 1000);

                      const res = await fetch(`/api/leads/${lead.id}/followup`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          title: followUpTitle || t("leads.sidebar.followup.defaultTitle", "Follow-up Meeting"),
                          description: followUpDesc,
                          startTime: start.toISOString(),
                          endTime: end.toISOString()
                        }),
                      });

                      const data = await safeJson(res);
                      if (!res.ok) throw new Error(data.error || "Failed to schedule");

                      toast.success(t("leads.sidebar.followup.success", "Follow-up scheduled in Bitrix24"));
                      setFollowUpTitle("");
                      setFollowUpDesc("");
                      setFollowUpDate("");
                      setFollowUpTime("");
                    } catch (err: any) {
                      toast.error(translateError(err.message));
                    } finally {
                      setScheduling(false);
                    }
                  }}
                  disabled={scheduling}
                  className="w-full py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {scheduling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  {t("leads.sidebar.followup.scheduleBtn", "Schedule in Bitrix24")}
                </button>
              </div>
            )}
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
              const data = await safeJson(res);

              if (!res.ok) throw new Error(data.error || "Failed to push");

              toast.success(t("common.pushedToBitrix", "Pushed to Bitrix24 successfully"));
              // Optionally update lead object locally if we want to show bitrix24Id
            } catch (err: any) {
              toast.error(translateError(err.message));
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
