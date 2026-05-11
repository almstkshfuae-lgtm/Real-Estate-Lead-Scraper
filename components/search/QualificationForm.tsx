"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  DollarSign, 
  MapPin, 
  Zap, 
  Filter, 
  Play,
  Save,
  Info,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function QualificationForm({ initialData }: { initialData?: any }) {
  const { t } = useTranslation('common');
  const [propertyTypes, setPropertyTypes] = useState<string[]>(initialData?.propertyTypes || []);
  const [budgetMin, setBudgetMin] = useState<number>(initialData?.budgetMin || 1000000);
  const [budgetMax, setBudgetMax] = useState<number>(initialData?.budgetMax || 10000000);
  const [emirates, setEmirates] = useState<string[]>(initialData?.emirates || []);
  const [relocated, setRelocated] = useState(initialData?.relocated || false);
  const [excludeRental, setExcludeRental] = useState(initialData?.excludeRental || true);

  // Sync state if initialData changes
  useEffect(() => {
    if (initialData) {
      setPropertyTypes(initialData.propertyTypes || []);
      setBudgetMin(initialData.budgetMin || 1000000);
      setBudgetMax(initialData.budgetMax || 10000000);
      setEmirates(initialData.emirates || []);
      setRelocated(initialData.relocated || false);
      setExcludeRental(initialData.excludeRental || true);
    }
  }, [initialData]);

  const toggleType = (type: string) => {
    setPropertyTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleEmirate = (emirate: string) => {
    setEmirates(prev => 
      prev.includes(emirate) ? prev.filter(e => e !== emirate) : [...prev, emirate]
    );
  };

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async (isScrape = false) => {
    setLoading(true);
    try {
      const criteria = {
        propertyTypes,
        budgetMin,
        budgetMax,
        emirates,
        relocated,
        excludeRental,
      };

      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        
        if (isScrape) {
          const scrapeRes = await fetch("/api/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ criteria }),
          });
          const scrapeData = await scrapeRes.json();
          alert(scrapeData.message || "Scrape initialized!");
        }
      }
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: 'apartment', label: t('search.types.apartment', 'Apartment') },
    { id: 'villa', label: t('search.types.villa', 'Villa') },
    { id: 'townhouse', label: t('search.types.townhouse', 'Townhouse') },
    { id: 'penthouse', label: t('search.types.penthouse', 'Penthouse') },
    { id: 'commercial', label: t('search.types.commercial', 'Commercial') },
  ];

  const emirateOptions = [
    'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-[var(--color-primary-subtle)] text-[var(--color-primary)] rounded-xl flex items-center justify-center">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('search.title')}</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{t('search.subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Left Column */}
          <div className="space-y-8">
            {/* Property Types */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                {t('search.propertyType')}
              </label>
              <div className="flex flex-wrap gap-2">
                {types.map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                      propertyTypes.includes(type.id)
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md"
                        : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-text-disabled)]"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Budget Range */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                {t('search.budget')}
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase ml-1">Min</p>
                  <input 
                    type="number" 
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase ml-1">Max</p>
                  <input 
                    type="number" 
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Emirates */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <MapPin className="w-4 h-4" />
                {t('search.emirates')}
              </label>
              <div className="flex flex-wrap gap-2">
                {emirateOptions.map(emirate => (
                  <button
                    key={emirate}
                    onClick={() => toggleEmirate(emirate)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      emirates.includes(emirate)
                        ? "bg-blue-50 text-[var(--color-primary)] border-[var(--color-primary)]"
                        : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)]"
                    }`}
                  >
                    {emirate}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            {/* Toggles */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                <Zap className="w-4 h-4" />
                {t('search.options')}
              </label>
              
              <div className="space-y-4">
                <button 
                  onClick={() => setRelocated(!relocated)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    relocated ? "bg-green-50 border-green-200" : "bg-white border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${relocated ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                      <Info className="w-4 h-4" />
                    </div>
                    <div className="text-start">
                      <p className={`text-sm font-bold ${relocated ? 'text-green-800' : 'text-[var(--color-text-primary)]'}`}>{t('search.relocated')}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{t('search.relocatedDesc')}</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-all ${relocated ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${relocated ? 'inset-inline-end-1' : 'inset-inline-start-1'}`}></div>
                  </div>
                </button>

                <button 
                  onClick={() => setExcludeRental(!excludeRental)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    excludeRental ? "bg-blue-50 border-blue-200" : "bg-white border-[var(--color-border)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${excludeRental ? 'bg-blue-200 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <div className="text-start">
                      <p className={`text-sm font-bold ${excludeRental ? 'text-blue-800' : 'text-[var(--color-text-primary)]'}`}>{t('search.excludeRental')}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{t('search.excludeRentalDesc')}</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full relative transition-all ${excludeRental ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${excludeRental ? 'inset-inline-end-1' : 'inset-inline-start-1'}`}></div>
                  </div>
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="p-6 rounded-3xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] space-y-4 text-start">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t('search.intelligenceTitle')}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">{t('search.estLeads')}</span>
                  <span className="font-bold text-[var(--color-success)]">~450</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">{t('search.scrapeDepth')}</span>
                  <span className="font-bold">{t('search.deepDepth')}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--color-border)]">
                <p className="text-[10px] text-[var(--color-text-disabled)] leading-relaxed italic">
                  {t('search.disclaimer')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 flex gap-4">
          <button 
            disabled={loading}
            onClick={() => handleSave(true)}
            className="flex-1 py-4 bg-[var(--color-primary)] text-white font-bold rounded-2xl hover:bg-[var(--color-primary-hover)] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
            {loading ? "Initializing..." : t('search.startScrape')}
          </button>
          <button 
            disabled={loading}
            onClick={() => handleSave(false)}
            className={`px-6 py-4 bg-white border border-[var(--color-border)] font-bold rounded-2xl hover:bg-[var(--color-bg-surface)] transition-all flex items-center justify-center ${saveSuccess ? 'text-green-500 border-green-200 bg-green-50' : 'text-[var(--color-text-secondary)]'}`}
          >
            {saveSuccess ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
