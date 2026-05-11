"use client";

import { useState, useEffect } from "react";
import LeadTable, { Lead } from "@/components/leads/LeadTable";
import LeadSidebar from "@/components/leads/LeadSidebar";
import { Download, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function LeadsPage() {
  const { t } = useTranslation('common');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t('leads.title')}</h1>
          <p className="text-[var(--color-text-secondary)]">{t('leads.subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'ADMIN' && (
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all">
              <Download className="w-4 h-4" />
              {t('leads.export')}
            </button>
          )}
          <Link 
            href="/search"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            {t('leads.newScrape')}
          </Link>
        </div>
      </div>

      <LeadTable onSelectLead={(lead) => setSelectedLead(lead)} />
      
      <LeadSidebar 
        lead={selectedLead} 
        onClose={() => setSelectedLead(null)} 
      />
    </div>
  );
}
