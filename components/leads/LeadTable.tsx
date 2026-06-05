"use client";

import { useState, useEffect } from "react";
import {
  MoreHorizontal,
  Loader2,
  Check,
  X,
  ExternalLink,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import ScoreBadge, { TierBadge, SignalChip } from "./ScoreBadge";

export type Lead = {
  id: string;
  name: string;
  nameAr?: string | null;
  company: string;
  companyAr?: string | null;
  role: string;
  roleAr?: string | null;
  source: string;
  sourceType?: string | null;
  tier: number;
  phone?: string | null;
  email?: string | null;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  score: number;
  signals: string[];
  propertyPref?: any | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  relocated?: boolean;
  rentalFlag?: boolean;
  status: string;
  notes?: string | null;
  bitrix24Id?: string | null;
  agentId: string;
  scrapeRunId: string;
  createdAt: string;
  updatedAt: string;
  persona?: string | null;
};

interface LeadTableProps {
  onSelectLead: (lead: Lead) => void;
  filters: {
    searchTerm: string;
    statusFilter: string;
    tierFilter: number | "";
    scrapeRunId?: string;
    refreshTrigger?: number;
  };
}

export default function LeadTable({ onSelectLead, filters }: LeadTableProps) {
  const { t } = useTranslation('common');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { searchTerm, statusFilter, tierFilter, scrapeRunId } = filters;
      let url = `/api/leads?search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (tierFilter) url += `&tier=${tierFilter}`;
      if (scrapeRunId) url += `&scrapeRunId=${scrapeRunId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();

      const parseSignals = (sig: any): string[] => {
        if (!sig) return [];
        if (Array.isArray(sig)) return sig.map(String);
        if (typeof sig === 'string') {
          try {
            const parsed = JSON.parse(sig);
            if (Array.isArray(parsed)) return parsed.map(String);
            if (typeof parsed === 'object' && parsed !== null) {
              return Object.values(parsed).map(String);
            }
            return [sig];
          } catch {
            if (sig.includes(',')) return sig.split(',').map(s => s.trim()).filter(Boolean);
            return [sig];
          }
        }
        if (typeof sig === 'object' && sig !== null) {
          return Object.values(sig).map(String);
        }
        return [];
      };

      const sanitizedLeads = (data.leads || []).map((l: any) => ({
        ...l,
        signals: parseSignals(l.signals)
      }));

      setLeads(sanitizedLeads);
    } catch (err: any) {
      toast.error("Error fetching leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const toggleSelectAll = () => {
    if (selectedIds.length === leads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(leads.map(l => l.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    setBulkUpdating(true);
    try {
      await Promise.all(selectedIds.map(id =>
        fetch(`/api/leads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      ));

      toast.success(t('common.bulkStatusUpdated', { count: selectedIds.length }));
      fetchLeads();
      setSelectedIds([]);
    } catch (err) {
      toast.error("Failed to update leads");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handlePushToBitrix = async () => {
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/leads/bulk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await safeJson(res);

      if (!res.ok) throw new Error(data.error || "Bulk push failed");

      if (data.failed > 0) {
        toast.warning(t('common.bulkPushPartial', {
          success: data.count,
          failed: data.failed,
          defaultValue: `Pushed ${data.count} leads, ${data.failed} failed.`
        }));
      } else {
        toast.success(t('common.bulkPushed', { count: selectedIds.length }));
      }

      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(t('common.confirmDelete', { count: selectedIds.length, defaultValue: `Are you sure you want to delete ${selectedIds.length} leads?` }))) return;

    setBulkUpdating(true);
    try {
      const res = await fetch("/api/leads/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || "Failed to delete leads");
      }

      toast.success(t('common.bulkDeleted', { count: selectedIds.length, defaultValue: `Successfully deleted ${selectedIds.length} leads` }));
      setSelectedIds([]);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBulkUpdating(false);
    }
  };

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm relative">
      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="absolute top-0 inset-x-0 z-20 bg-[var(--color-primary)] text-white p-3 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedIds([])}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold">{t('common.leadsSelected', { count: selectedIds.length })}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleBulkStatusUpdate('contacted')}
              disabled={bulkUpdating}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            >
              {bulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              {t('common.markContacted')}
            </button>
            <button
              onClick={handlePushToBitrix}
              disabled={bulkUpdating}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-card)] text-[var(--color-primary)] rounded-lg text-xs font-bold transition-all shadow-lg hover:bg-[var(--color-bg-surface)] disabled:opacity-50"
            >
              {bulkUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
              {t('common.pushBitrix')}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkUpdating}
              className="p-2 hover:bg-red-500 rounded-lg transition-colors text-white disabled:opacity-50"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-[var(--color-bg-card)]/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          </div>
        )}

        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="bg-[var(--color-bg-surface)]/30 text-[var(--color-text-secondary)] text-[10px] font-bold uppercase tracking-widest border-b border-[var(--color-border)]">
              <th className="px-6 py-4">
                <div
                  onClick={toggleSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-all ${selectedIds.length === leads.length && leads.length > 0
                    ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                    }`}
                >
                  {selectedIds.length === leads.length && leads.length > 0 && <Check className="w-3 h-3 text-white" />}
                </div>
              </th>
              <th className="px-6 py-4 font-bold">{t('leads.table.score')}</th>
              <th className="px-6 py-4 font-bold">{t('leads.table.detail')}</th>
              <th className="px-6 py-4 font-bold">{t('leads.table.tier')}</th>
              <th className="px-6 py-4 font-bold">{t('leads.table.signals')}</th>
              <th className="px-6 py-4 font-bold">{t('leads.table.status')}</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className={`transition-colors cursor-pointer group ${selectedIds.includes(lead.id)
                  ? "bg-[var(--color-primary-subtle)]/50"
                  : "hover:bg-[var(--color-primary-subtle)]/30"
                  }`}
                onClick={() => onSelectLead(lead)}
              >
                <td className="px-6 py-4" onClick={(e) => toggleSelect(lead.id, e)}>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedIds.includes(lead.id)
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-card)] group-hover:border-[var(--color-primary)]"
                      }`}
                  >
                    {selectedIds.includes(lead.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      {lead.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{t('common.roleAt', { role: lead.role, company: lead.company })}</div>
                    <div className="text-[10px] text-[var(--color-text-disabled)] mt-1">{lead.location}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1.5">
                    <TierBadge tier={lead.tier} />
                    <div className="text-[10px] text-[var(--color-text-secondary)] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[var(--color-text-disabled)]"></span>
                      {lead.source}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {Array.isArray(lead.signals) && lead.signals.map((signal, i) => (
                      <SignalChip key={i} signal={signal} />
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${lead.status === 'new' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                    lead.status === 'contacted' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' :
                      lead.status === 'qualified' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                        lead.status === 'proposal' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                    {t(`leads.status.${lead.status}`, lead.status)}
                  </span>
                </td>
                <td className="px-6 py-4 text-end">
                  <button className="p-2 rounded-lg hover:bg-[var(--color-bg-surface)] text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)] transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leads.length === 0 && !loading && (
        <div className="p-12 text-center">
          <p className="text-[var(--color-text-secondary)]">{t('leads.table.empty')}</p>
        </div>
      )}

      <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/20 flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t('leads.table.pagination', { count: leads.length, total: leads.length })}
        </p>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded-lg border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg-surface)] disabled:opacity-50" disabled>{t('common.previous')}</button>
          <button className="px-3 py-1 rounded-lg border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg-surface)] disabled:opacity-50" disabled>{t('common.next')}</button>
        </div>
      </div>
    </div>
  );
}
