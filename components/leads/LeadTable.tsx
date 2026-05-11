"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar,
  ChevronDown,
  Loader2
} from "lucide-react";
import { useTranslation } from "react-i18next";
import ScoreBadge, { TierBadge, SignalChip } from "./ScoreBadge";

export type Lead = {
  id: string;
  name: string;
  company: string;
  role: string;
  source: string;
  tier: number;
  location: string;
  score: number;
  signals: string[];
  status: string;
  phone?: string;
  email?: string;
  createdAt: string;
};

export default function LeadTable({ onSelectLead }: { onSelectLead: (lead: Lead) => void }) {
  const { t } = useTranslation('common');
  const [searchTerm, setSearchTerm] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leads?search=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error("Failed to fetch leads");
      const data = await res.json();
      
      // Transform signals if they are JSON strings or objects
      const sanitizedLeads = data.leads.map((l: any) => ({
        ...l,
        signals: Array.isArray(l.signals) ? l.signals : 
                (typeof l.signals === 'string' ? JSON.parse(l.signals) : [])
      }));
      
      setLeads(sanitizedLeads);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 500); // Debounce search
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row justify-between gap-4 bg-[var(--color-bg-surface)]/50">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder={t('leads.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm font-medium hover:bg-[var(--color-bg-card)] transition-all">
            <Filter className="w-4 h-4" />
            {t('leads.filters')}
            <ChevronDown className="w-3 h-3" />
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border border-[var(--color-border)] rounded-xl text-sm font-medium hover:bg-[var(--color-bg-card)] transition-all">
            <Calendar className="w-4 h-4" />
            {t('leads.dateRange')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          </div>
        )}
        
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="bg-[var(--color-bg-surface)]/30 text-[var(--color-text-secondary)] text-[10px] font-bold uppercase tracking-widest border-b border-[var(--color-border)]">
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
                className="hover:bg-[var(--color-primary-subtle)]/30 transition-colors cursor-pointer group"
                onClick={() => onSelectLead(lead)}
              >
                <td className="px-6 py-4">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                      {lead.name}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{lead.role} at {lead.company}</div>
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
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      // In a real app, update DB here via API
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-transform active:scale-95 ${
                      lead.status === 'new' ? 'bg-blue-50 text-blue-600' :
                      lead.status === 'contacted' ? 'bg-orange-50 text-orange-600' :
                      'bg-green-50 text-green-600'
                    }`}
                  >
                    {t(`leads.status.${lead.status}`, lead.status)}
                  </button>
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
          <button className="px-3 py-1 rounded-lg border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg-surface)] disabled:opacity-50" disabled>Previous</button>
          <button className="px-3 py-1 rounded-lg border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg-surface)] disabled:opacity-50" disabled>Next</button>
        </div>
      </div>
    </div>
  );
}
