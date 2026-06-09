"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Megaphone, Users, RefreshCw, Send, ChevronDown, ChevronRight,
  Sparkles, Mail, MessageSquare, AlertCircle, CheckCircle2, Play,
  ExternalLink, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";

export default function CampaignsPage() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  const lang = i18n.language === "ar" ? "ar" : "en";

  const [groupBy, setGroupBy] = useState<"propertyType" | "tier">("propertyType");
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [pushing, setPushing] = useState<string | null>(null);

  // Outreach Campaign States (keyed by group key)
  const [selectedChannel, setSelectedChannel] = useState<Record<string, "whatsapp" | "email">>({});
  const [selectedTone, setSelectedTone] = useState<Record<string, "professional" | "formal" | "casual">>({});
  const [templateText, setTemplateText] = useState<Record<string, string>>({});
  const [generatingTemplate, setGeneratingTemplate] = useState<Record<string, boolean>>({});
  const [outreachStatus, setOutreachStatus] = useState<Record<string, "idle" | "sending" | "success" | "error">>({});
  const [outreachProgress, setOutreachProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [outreachReport, setOutreachReport] = useState<Record<string, { successCount: number; failCount: number }>>({});

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns?groupBy=${groupBy}`);
      if (!res.ok) throw new Error("Failed to fetch groups");
      const json = await res.json();
      setGroups(json.data || []);

      // Expand all by default
      const expanded: Record<string, boolean> = {};
      (json.data || []).forEach((g: any) => {
        expanded[g.key] = true;
      });
      setExpandedGroups(expanded);
    } catch (e) {
      toast.error(t("common.notAvailable", "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [groupBy]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePushGroup = async (group: any) => {
    setPushing(group.key);
    try {
      const leadIds = group.leads.map((l: any) => l.id);
      const res = await fetch("/api/leads/bulk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Push failed");
      }

      const json = await safeJson(res).catch(() => ({} as any));
      toast.success(t("common.bulkPushed", "Successfully pushed leads").replace("{{count}}", json.count?.toString() || leadIds.length));
    } catch (e: any) {
      toast.error(e.message || t("common.notAvailable", "Failed to push group"));
    } finally {
      setPushing(null);
    }
  };

  const handleGenerateTemplate = async (group: any) => {
    const key = group.key;
    const tone = selectedTone[key] || "professional";
    
    setGeneratingTemplate(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch("/api/campaigns/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupBy,
          groupKey: key,
          lang,
          tone
        })
      });

      if (!res.ok) throw new Error("Template generation failed");
      const data = await res.json();
      setTemplateText(prev => ({ ...prev, [key]: data.template || "" }));
      toast.success(t("ai.scoreRefined", "AI Template generated successfully"));
    } catch (e: any) {
      toast.error(t("ai.pitchError", "Failed to generate pitch"));
    } finally {
      setGeneratingTemplate(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSendCampaign = async (group: any) => {
    const key = group.key;
    const channel = selectedChannel[key] || "whatsapp";
    const template = templateText[key];
    const leadsList = group.leads || [];

    if (!template) {
      toast.error(t("campaigns.templatePlaceholder", "Please generate or write a template first"));
      return;
    }

    setOutreachStatus(prev => ({ ...prev, [key]: "sending" }));
    setOutreachProgress(prev => ({ ...prev, [key]: { current: 0, total: leadsList.length } }));

    try {
      const leadIds = leadsList.map((l: any) => l.id);
      const res = await fetch("/api/campaigns/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds,
          channel,
          templateText: template
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Outreach failed");

      setOutreachReport(prev => ({
        ...prev,
        [key]: {
          successCount: data.successCount || 0,
          failCount: data.failCount || 0
        }
      }));

      if (data.failCount > 0) {
        setOutreachStatus(prev => ({ ...prev, [key]: "error" }));
        toast.warning(t("campaigns.outreachError", "Outreach completed with errors")
          .replace("{{successCount}}", data.successCount.toString())
          .replace("{{failCount}}", data.failCount.toString())
        );
      } else {
        setOutreachStatus(prev => ({ ...prev, [key]: "success" }));
        toast.success(t("campaigns.outreachSuccess", "Outreach campaign successfully completed")
          .replace("{{successCount}}", data.successCount.toString())
          .replace("{{failCount}}", data.failCount.toString())
        );
      }
    } catch (e: any) {
      setOutreachStatus(prev => ({ ...prev, [key]: "idle" }));
      toast.error(e.message || "Outreach failed");
    }
  };

  const getInterpolatedPreview = (template: string, lead: any) => {
    if (!template || !lead) return "";
    return template
      .replace(/{{name}}/g, lead.name || "")
      .replace(/{{company}}/g, lead.company || "")
      .replace(/{{location}}/g, lead.location || "");
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {t("campaigns.title", "Campaign Manager")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("campaigns.subtitle", "Manage Bitrix24 campaigns and automated outreach.")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t("campaigns.grouping", "Grouping")}:
          </span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="propertyType">{t("campaigns.groups.propertyType", "Group by Property Type")}</option>
            <option value="tier">{t("campaigns.groups.tier", "Group by Tier")}</option>
          </select>
          <button
            onClick={fetchGroups}
            className="p-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-md hover:bg-[var(--color-bg-card)] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center p-12 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)]">
          <p className="text-[var(--color-text-secondary)]">{t("campaigns.emptyGroups", "No leads found for grouping.")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isExpanded = expandedGroups[group.key];
            const isPushing = pushing === group.key;

            // Format key label
            let displayKey = group.key;
            if (groupBy === "propertyType") {
              const types = t("search.types", { returnObjects: true }) as any;
              displayKey = types?.[group.key.toLowerCase()] || group.key;
            } else if (groupBy === "tier") {
              const tiers = t("leads.tiers", { returnObjects: true }) as any;
              displayKey = tiers?.[group.key.toLowerCase()] || group.key;
            }

            // Capitalize fallback
            if (displayKey.length > 0 && displayKey === group.key) {
              displayKey = displayKey.charAt(0).toUpperCase() + displayKey.slice(1);
            }

            const key = group.key;
            const channel = selectedChannel[key] || "whatsapp";
            const tone = selectedTone[key] || "professional";
            const template = templateText[key] || "";
            const isGenerating = generatingTemplate[key] || false;
            const status = outreachStatus[key] || "idle";
            const progress = outreachProgress[key] || { current: 0, total: 0 };
            const report = outreachReport[key];

            return (
              <div key={group.key} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
                {/* Header card */}
                <div
                  className="flex items-center justify-between p-4 bg-[var(--color-bg-card)] cursor-pointer hover:bg-[var(--color-bg-surface-hover)] transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                    ) : (
                      <ChevronRight className={`w-5 h-5 text-[var(--color-text-secondary)] ${isRtl ? "rtl-mirror" : ""}`} />
                    )}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center">
                        <Users className="w-4 h-4 text-[var(--color-primary)]" />
                      </div>
                      <h3 className="font-semibold text-[var(--color-text-primary)] text-lg">
                        {displayKey === "unknown" ? "Other" : displayKey}
                      </h3>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                        {t("campaigns.totalLeads", "{{count}} Leads").replace("{{count}}", group.count.toString())}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handlePushGroup(group)}
                      disabled={isPushing}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-surface-hover)] disabled:opacity-50 transition-all"
                    >
                      {isPushing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ExternalLink className={`w-4 h-4 ${isRtl ? "rtl-mirror" : ""}`} />
                      )}
                      <span className="hidden sm:inline">{t("campaigns.pushGroup", "Push Group to Bitrix24")}</span>
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-t border-[var(--color-border)]">
                    {/* Left Column: Lead List */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] text-start">
                        {t("leads.title", "Leads List")}
                      </h4>
                      <div className="border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)] overflow-hidden max-h-[420px] overflow-y-auto bg-[var(--color-bg-card)]/30">
                        {group.leads.map((lead: any) => (
                          <div key={lead.id} className="p-3 px-6 flex items-center justify-between hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                            <div className="text-start">
                              <p className="font-semibold text-sm text-[var(--color-text-primary)]">{lead.name}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{lead.company}</p>
                            </div>
                            <div className="text-end">
                              <p className="text-xs font-semibold text-[var(--color-text-primary)]" dir="ltr">{lead.phone || t("common.notAvailable")}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{lead.email || t("common.notAvailable")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column: AI Campaign Outreach Workspace */}
                    <div className="space-y-4 p-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]/50 text-start flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
                            {t("campaigns.outreachTitle", "Campaign Outreach & Pitches")}
                          </h4>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("campaigns.outreachSubtitle", "Compose and send personalized pitches to this group via WhatsApp or Email.")}
                        </p>

                        {/* Tone & Channel Selector */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("campaigns.outreachChannel", "Channel")}</label>
                            <select
                              value={channel}
                              onChange={(e) => setSelectedChannel(prev => ({ ...prev, [key]: e.target.value as any }))}
                              className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg p-2 text-xs font-medium text-[var(--color-text-primary)] outline-none"
                            >
                              <option value="whatsapp">WhatsApp</option>
                              <option value="email">Email</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("campaigns.tone", "Tone")}</label>
                            <select
                              value={tone}
                              onChange={(e) => setSelectedTone(prev => ({ ...prev, [key]: e.target.value as any }))}
                              className="w-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg p-2 text-xs font-medium text-[var(--color-text-primary)] outline-none"
                            >
                              <option value="professional">{t("ai.style.professional", "Professional")}</option>
                              <option value="formal">{t("ai.style.formal", "Formal")}</option>
                              <option value="casual">{t("ai.style.casual", "Casual")}</option>
                            </select>
                          </div>
                        </div>

                        {/* Generate Button */}
                        <button
                          onClick={() => handleGenerateTemplate(group)}
                          disabled={isGenerating || status === "sending"}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] font-bold text-xs rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {isGenerating ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {isGenerating ? t("campaigns.generating", "Generating...") : t("campaigns.generateBtn", "Generate AI Pitch Template")}
                        </button>

                        {/* Template Area */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("leads.sidebar.tabs.details", "Template Workspace")}</label>
                          <textarea
                            value={template}
                            onChange={(e) => setTemplateText(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full h-24 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-xs outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all resize-none"
                            placeholder={t("campaigns.templatePlaceholder", "Write template...")}
                          />
                        </div>

                        {/* Preview panel */}
                        {template && group.leads && group.leads.length > 0 && (
                          <div className="p-3 bg-[var(--color-bg-surface)] rounded-lg border border-[var(--color-border)] text-xs space-y-1">
                            <span className="font-bold text-[var(--color-text-secondary)]">{t("campaigns.previewTitle", "Preview for first lead:")}</span>
                            <p className="text-[var(--color-text-primary)] italic font-medium">
                              &ldquo;{getInterpolatedPreview(template, group.leads[0])}&rdquo;
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Execution Progress & Trigger */}
                      <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
                        {status === "sending" && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-[var(--color-text-primary)]">
                              <span>{t("campaigns.sendingProgress").replace("{{current}}", progress.current.toString()).replace("{{total}}", progress.total.toString())}</span>
                              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                            </div>
                            <div className="w-full bg-[var(--color-border)] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {status === "success" && report && (
                          <div className="p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900/30 rounded-lg text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              {t("campaigns.outreachSuccess", "Success!")
                                .replace("{{successCount}}", report.successCount.toString())
                                .replace("{{failCount}}", report.failCount.toString())}
                            </span>
                          </div>
                        )}

                        {status === "error" && report && (
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-lg text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>
                              {t("campaigns.outreachError", "Failed")
                                .replace("{{successCount}}", report.successCount.toString())
                                .replace("{{failCount}}", report.failCount.toString())}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={() => handleSendCampaign(group)}
                          disabled={status === "sending" || !template}
                          className="w-full py-2.5 bg-[var(--color-primary)] text-white font-bold text-xs rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {status === "sending" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                          {status === "sending" ? t("common.sending", "Sending...") : t("campaigns.sendOutreachBtn", "Launch Campaign Outreach")}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
