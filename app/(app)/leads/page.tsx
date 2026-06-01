"use client";

import { useState, useEffect } from "react";
import LeadTable, { Lead } from "@/components/leads/LeadTable";
import LeadPipeline from "@/components/leads/LeadPipeline";
import LeadSidebar from "@/components/leads/LeadSidebar";
import { 
  Download, 
  Plus, 
  LayoutGrid, 
  List, 
  Search, 
  Filter, 
  RotateCcw 
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CsvUpload from "@/components/leads/CsvUpload";

export default function LeadsPage() {
  const { t } = useTranslation('common');
  const searchParams = useSearchParams();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<any>(null);
  
  // Shared Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tierFilter, setTierFilter] = useState<number | "">("");
  const [scrapeRunIdFilter, setScrapeRunIdFilter] = useState(searchParams?.get("scrapeRunId") || "");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(err => console.error(err));
  }, []);

  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  const exportLeads = async (format: 'csv' | 'xlsx') => {
    try {
      const toastId = (await import('sonner')).toast.loading(t('leads.exporting', 'Exporting...'));
      let url = "/api/export?format=" + format + "&search=" + encodeURIComponent(searchTerm);
      if (statusFilter) url += "&status=" + statusFilter;
      if (tierFilter) url += "&tier=" + tierFilter;
      if (scrapeRunIdFilter) url += "&scrapeRunId=" + scrapeRunIdFilter;
      const res = await fetch(url);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        (await import('sonner')).toast.success(t('leads.exportSuccess', 'Exported successfully'), { id: toastId });
      } else {
        throw new Error(data.error || 'Failed to export');
      }
    } catch (e: any) {
      (await import('sonner')).toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('leads.title')}</h1>
          <p className="text-[var(--color-text-secondary)]">{t('leads.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <div className="flex bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-border)]">
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'list' ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <List className="w-3.5 h-3.5" />
              {t('common.viewList')}
            </button>
            <button 
              onClick={() => setView('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'kanban' ? 'bg-[var(--color-bg-card)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              {t('common.viewKanban')}
            </button>
          </div>

          <button 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-surface)] transition-all"
          >
            <RotateCcw className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>

          {user && (
            <div className="flex gap-2">
              <button 
                onClick={() => exportLeads('csv')}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button 
                onClick={() => exportLeads('xlsx')}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
              >
                <Download className="w-4 h-4" />
                XLSX
              </button>
            </div>
          )}
          <CsvUpload onSuccess={handleRefresh} />

          <Link 
            href="/search"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            {t('leads.newScrape')}
          </Link>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder={t('leads.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]/30 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 md:w-40 px-3 py-2.5 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          >
            <option value="">{t('leads.status.all', 'All Statuses')}</option>
            <option value="new">{t('leads.status.new')}</option>
            <option value="contacted">{t('leads.status.contacted')}</option>
            <option value="qualified">{t('leads.status.qualified')}</option>
            <option value="proposal">{t('leads.status.proposal')}</option>
            <option value="closed">{t('leads.status.closed')}</option>
          </select>
          
          <select 
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value ? parseInt(e.target.value) : "")}
            className="flex-1 md:w-40 px-3 py-2.5 border border-[var(--color-border)] rounded-xl text-sm font-medium bg-[var(--color-bg-surface)] outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
          >
            <option value="">{t('leads.tiers.all', 'All Tiers')}</option>
            <option value="1">{t('leads.tiers.t1')}</option>
            <option value="2">{t('leads.tiers.t2')}</option>
            <option value="3">{t('leads.tiers.t3')}</option>
          </select>
        </div>
      </div>

      {/* Main View Area */}
      <div key={refreshKey}>
        {view === 'list' ? (
          <LeadTable 
            onSelectLead={(lead) => setSelectedLead(lead)} 
            filters={{ searchTerm, statusFilter, tierFilter, scrapeRunId: scrapeRunIdFilter }}
          />
        ) : (
          <LeadPipeline 
            onSelectLead={(lead) => setSelectedLead(lead)} 
            filters={{ searchTerm, statusFilter, tierFilter, scrapeRunId: scrapeRunIdFilter }}
          />
        )}
      </div>
      
      <LeadSidebar 
        lead={selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />
    </div>
  );
}
