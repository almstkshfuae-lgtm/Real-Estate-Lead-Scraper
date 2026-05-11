"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle, AlertCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface CsvUploadProps {
  onSuccess?: () => void;
}

export default function CsvUpload({ onSuccess }: CsvUploadProps) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast.error(t('leads.upload.invalidFormat', "Please upload a valid CSV file"));
      return;
    }
    setFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleUpload = async () => {
    if (!parsedData.length) return;
    setIsUploading(true);

    try {
      const response = await fetch('/api/leads/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads: parsedData }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      toast.success(t('leads.upload.success', `Successfully imported ${data.savedCount} leads.`));
      setIsOpen(false);
      setFile(null);
      setParsedData([]);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(t('leads.upload.error', `Import failed: ${err.message}`));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
      >
        <UploadCloud className="w-4 h-4" />
        {t('leads.importCsv', 'Import CSV')}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-[var(--color-border)]">
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {t('leads.upload.title', 'Import Leads via CSV')}
              </h2>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[var(--color-bg-surface)] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            <div className="p-6">
              {!file ? (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging 
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' 
                      : 'border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-surface)]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className={`w-10 h-10 mb-4 ${isDragging ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`} />
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {t('leads.upload.dragDrop', 'Drag and drop your CSV file here')}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t('leads.upload.clickBrowse', 'or click to browse from your computer')}
                  </p>
                  <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/20 p-2 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{file.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t('leads.upload.rowCount', { count: parsedData.length, defaultValue: `${parsedData.length} rows found` })}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setFile(null); setParsedData([]); }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      {t('common.remove', 'Remove')}
                    </button>
                  </div>
                  
                  {parsedData.length > 0 && (
                    <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        {t('leads.upload.previewNote', 'We will assign Tier 1 and "Manual Import" to all imported leads. Deduplication will be applied automatically.')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] flex justify-end gap-3">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                disabled={isUploading}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button 
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('common.processing', 'Processing...')}
                  </>
                ) : (
                  t('leads.upload.confirm', 'Import Leads')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
