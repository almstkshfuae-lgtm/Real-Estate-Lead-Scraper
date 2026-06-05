"use client";

import { useState, useEffect } from "react";
import { 
  MoreHorizontal, 
  Loader2,
  GripVertical
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import ScoreBadge, { TierBadge } from "./ScoreBadge";
import { Lead } from "./LeadTable";

const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'closed'];

interface LeadPipelineProps {
  onSelectLead: (lead: Lead) => void;
  filters: {
    searchTerm: string;
    statusFilter: string;
    tierFilter: number | "";
    scrapeRunId?: string;
  };
}

export default function LeadPipeline({ onSelectLead, filters }: LeadPipelineProps) {
  const { t, i18n } = useTranslation('common');
  const isRTL = i18n.language === 'ar';
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      
      const sanitizedLeads = (data.leads || []).map((l: any) => ({
        ...l,
        signals: Array.isArray(l.signals) ? l.signals : 
                (typeof l.signals === 'string' ? JSON.parse(l.signals) : [])
      }));
      
      setLeads(sanitizedLeads);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const leadId = draggableId;

    const oldLeads = [...leads];
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    
    try {
      setUpdatingId(leadId);
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (res.ok) {
        toast.success(t('common.statusUpdated', { name: leads.find(l => l.id === leadId)?.name }));
      } else {
        throw new Error("Failed to update");
      }
    } catch (err) {
      console.error(err);
      setLeads(oldLeads);
      toast.error("Failed to update lead status");
    } finally {
      setUpdatingId(null);
    }
  };

  const getLeadsByStatus = (status: string) => leads.filter(l => l.status === status);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 overflow-x-auto pb-6 min-h-[600px] scrollbar-hide" dir={isRTL ? 'rtl' : 'ltr'}>
        {STATUSES.map((status) => (
          <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                  {t(`leads.status.${status}`)}
                </h3>
                <span className="bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {getLeadsByStatus(status).length}
                </span>
              </div>
              <button className="p-1 hover:bg-[var(--color-bg-surface)] rounded-md text-[var(--color-text-disabled)] transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <Droppable droppableId={status}>
              {(provided, snapshot) => (
                <div 
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`flex-1 rounded-2xl p-3 border transition-colors space-y-3 min-h-[500px] ${
                    snapshot.isDraggingOver 
                      ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30" 
                      : "bg-[var(--color-bg-surface)]/30 border-[var(--color-border)]/50"
                  }`}
                >
                  {getLeadsByStatus(status).map((lead, index) => (
                    <Draggable key={lead.id} draggableId={lead.id} index={index}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          onClick={() => onSelectLead(lead)}
                          className={`bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[var(--color-primary)]/50 transition-all cursor-pointer group relative ${
                            snapshot.isDragging ? "shadow-xl ring-2 ring-[var(--color-primary)]/20 z-50" : ""
                          }`}
                        >
                          {updatingId === lead.id && (
                            <div className="absolute inset-0 bg-[var(--color-bg-card)]/60 backdrop-blur-[1px] rounded-xl z-10 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
                            </div>
                          )}
                          
                          <div className="flex justify-between items-start mb-3">
                            <ScoreBadge score={lead.score} />
                            <div className="flex items-center gap-2">
                              <TierBadge tier={lead.tier} />
                              <div {...provided.dragHandleProps} className="text-[var(--color-text-disabled)] cursor-grab active:cursor-grabbing">
                                <GripVertical className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          <div className="mb-4">
                            <h4 className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors">
                              {lead.name}
                            </h4>
                            <p className="text-[10px] text-[var(--color-text-secondary)] truncate">{t('leads.pipeline.roleAt', { role: lead.role, company: lead.company })}</p>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]/50">
                            <div className="text-[10px] text-[var(--color-text-disabled)]">
                              {lead.source}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {getLeadsByStatus(status).length === 0 && !loading && (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-[var(--color-border)] rounded-xl">
                      <p className="text-[10px] text-[var(--color-text-disabled)] uppercase font-bold tracking-widest">{t('leads.pipeline.empty')}</p>
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
}
