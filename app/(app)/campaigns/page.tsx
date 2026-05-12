"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, Users, RefreshCw, Send, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function CampaignsPage() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  
  const [groupBy, setGroupBy] = useState<"propertyType" | "tier">("propertyType");
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [pushing, setPushing] = useState<string | null>(null);

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
      
      if (!res.ok) throw new Error("Push failed");
      
      const json = await res.json();
      toast.success(t("common.bulkPushed", "Successfully pushed leads to Bitrix24").replace("{{count}}", json.successCount));
    } catch (e: any) {
      toast.error(t("common.notAvailable", "Failed to push group"));
    } finally {
      setPushing(null);
    }
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

            return (
              <div key={group.key} className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
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
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-[var(--color-primary)] text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                      {isPushing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className={`w-4 h-4 ${isRtl ? "rtl-mirror" : ""}`} />
                      )}
                      <span className="hidden sm:inline">{t("campaigns.pushGroup", "Push Group to Bitrix24")}</span>
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {group.leads.slice(0, 10).map((lead: any) => (
                      <div key={lead.id} className="p-3 px-6 flex items-center justify-between hover:bg-[var(--color-bg-surface-hover)] transition-colors">
                        <div>
                          <p className="font-medium text-[var(--color-text-primary)]">{lead.name}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{lead.company}</p>
                        </div>
                        <div className="text-end">
                          <p className="text-sm text-[var(--color-text-secondary)]" dir="ltr">{lead.phone}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{lead.email}</p>
                        </div>
                      </div>
                    ))}
                    {group.count > 10 && (
                      <div className="p-3 text-center bg-[var(--color-bg-card)]">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                          + {group.count - 10} more leads
                        </span>
                      </div>
                    )}
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
