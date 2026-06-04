"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle, AlertCircle, X, Eye, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface CsvUploadProps {
  onSuccess?: () => void;
}

// ─── Column name mapping ──────────────────────────────────────────────────────
// Maps any known header variant (Arabic / English / exported headers) to a
// canonical field name consumed by the import API route.
const HEADER_ALIASES: Record<string, string> = {
  // name
  name: "name",
  Name: "name",
  "Name (EN)": "name",
  "Name (AR)": "name",
  "الاسم": "name",
  "الاسم الكامل": "name",
  "Full Name": "name",
  "full name": "name",
  "fullname": "name",

  // email
  email: "email",
  Email: "email",
  "البريد الإلكتروني": "email",
  "البريد": "email",
  "E-Mail": "email",
  "e-mail": "email",

  // phone
  phone: "phone",
  Phone: "phone",
  "Phone Number": "phone",
  "رقم الهاتف": "phone",
  "رقم التليفون": "phone",
  "الهاتف": "phone",
  "Mobile": "phone",
  "mobile": "phone",
  "Tel": "phone",
  "tel": "phone",
  "Telephone": "phone",

  // company
  company: "company",
  Company: "company",
  "Company (EN)": "company",
  "Company (AR)": "company",
  "الشركة": "company",
  "اسم الشركة": "company",
  "Organization": "company",

  // role
  role: "role",
  Role: "role",
  "Role (EN)": "role",
  "Role (AR)": "role",
  "المنصب": "role",
  "الوظيفة": "role",
  "Job Title": "role",
  "Title": "role",
  "Position": "role",

  // location
  location: "location",
  Location: "location",
  "الموقع": "location",
  "العنوان": "location",
  "Address": "location",
  "address": "location",
  "City": "location",
  "city": "location",
  "Emirate": "location",
  "emirate": "location",
  "المدينة": "location",
  "الإمارة": "location",
};

/**
 * Normalise a raw PapaParse row using HEADER_ALIASES.
 * Unknown columns are preserved as-is so the API can still see them.
 */
function normalizeRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const canonical = HEADER_ALIASES[key.trim()] || key.trim();
    // Prefer first occurrence so duplicate aliases don't overwrite
    if (!(canonical in out)) {
      out[canonical] = String(value ?? "").trim();
    }
  }
  return out;
}

export default function CsvUpload({ onSuccess }: CsvUploadProps) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<{
    savedCount: number;
    updatedCount: number;
    skippedCount: number;
    totalProcessed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
      toast.error(t("leads.upload.invalidFormat", "Please upload a valid CSV file"));
      return;
    }
    setFile(selectedFile);
    setImportResult(null);
    setShowPreview(false);

    Papa.parse<Record<string, string>>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      // CRITICAL: keep phone numbers as strings — prevents 05XXXXXXXX → 5XXXXXXXX
      dynamicTyping: false,
      // Handle UTF-8 with BOM (exported files) and UTF-16 Arabic files
      encoding: "UTF-8",
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parse warnings:", results.errors);
        }
        const headers = results.meta.fields ?? [];
        setDetectedHeaders(headers);
        // Normalise every row through the alias map
        const normalised = (results.data as Record<string, string>[]).map(normalizeRow);
        setParsedData(normalised);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
        setFile(null);
      },
    });
  };

  const handleUpload = async () => {
    if (!parsedData.length) return;
    setIsUploading(true);
    setImportResult(null);

    try {
      const response = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsedData }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(errBody);
      }

      const data = await response.json();
      setImportResult(data);
      toast.success(
        t("leads.upload.success", `Successfully imported ${data.savedCount} leads.`, {
          count: data.savedCount,
        })
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error(t("leads.upload.error", `Import failed: ${err.message}`));
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFile(null);
    setParsedData([]);
    setDetectedHeaders([]);
    setImportResult(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Preview: first 3 rows, canonical columns that we know about
  const PREVIEW_COLS = ["name", "email", "phone", "company", "role", "location"];
  const previewRows = parsedData.slice(0, 3);

  return (
    <>
      <button
        id="csv-upload-trigger"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold hover:bg-[var(--color-bg-surface)] transition-all"
      >
        <UploadCloud className="w-4 h-4" />
        {t("leads.importCsv", "Import CSV")}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-[var(--color-border)] flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[var(--color-border)] shrink-0">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {t("leads.upload.title", "Import Leads via CSV")}
              </h2>
              <button
                id="csv-upload-close"
                onClick={handleClose}
                className="p-1 hover:bg-[var(--color-bg-surface)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {!file ? (
                /* ── Drop zone ── */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                      : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-surface)]"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud
                    className={`w-10 h-10 mb-4 ${
                      isDragging ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"
                    }`}
                  />
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
                    {t("leads.upload.dragDrop", "Drag and drop your CSV file here")}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("leads.upload.clickBrowse", "or click to browse from your computer")}
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
                <>
                  {/* ── File info card ── */}
                  <div className="flex items-center justify-between p-3 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/20 p-2 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">{file.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("leads.upload.rowCount", {
                            count: parsedData.length,
                            defaultValue: `${parsedData.length} rows found`,
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedData([]);
                        setDetectedHeaders([]);
                        setImportResult(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      {t("common.remove", "Remove")}
                    </button>
                  </div>

                  {/* ── Detected columns ── */}
                  {detectedHeaders.length > 0 && (
                    <div className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] p-3">
                      <p className="text-xs font-bold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">
                        {t("leads.upload.detectedColumns", "Detected Columns")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedHeaders.map((h) => {
                          const canonical = HEADER_ALIASES[h.trim()];
                          return (
                            <span
                              key={h}
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                canonical
                                  ? "bg-green-500/15 text-green-600 dark:text-green-400"
                                  : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {h}
                              {canonical && canonical !== h.trim() && (
                                <span className="opacity-60"> → {canonical}</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Data preview toggle ── */}
                  {parsedData.length > 0 && (
                    <button
                      onClick={() => setShowPreview((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary)] hover:underline"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {showPreview
                        ? t("leads.upload.hidePreview", "Hide Preview")
                        : t("leads.upload.showPreview", "Preview first 3 rows")}
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${showPreview ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}

                  {showPreview && previewRows.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                      <table className="text-xs w-full">
                        <thead>
                          <tr className="bg-[var(--color-bg-surface)]">
                            {PREVIEW_COLS.filter((c) =>
                              previewRows.some((r) => r[c])
                            ).map((col) => (
                              <th
                                key={col}
                                className="px-3 py-2 text-left font-bold text-[var(--color-text-secondary)] whitespace-nowrap capitalize"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.map((row, i) => (
                            <tr
                              key={i}
                              className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-surface)]"
                            >
                              {PREVIEW_COLS.filter((c) =>
                                previewRows.some((r) => r[c])
                              ).map((col) => (
                                <td
                                  key={col}
                                  className="px-3 py-2 text-[var(--color-text-primary)] max-w-[140px] truncate"
                                  title={row[col] || "—"}
                                >
                                  {row[col] || (
                                    <span className="text-[var(--color-text-secondary)] italic">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Info banner ── */}
                  <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      {t(
                        "leads.upload.previewNote",
                        'We will assign Tier 1 and "Manual Import" to all imported leads. Deduplication will be applied automatically.'
                      )}
                    </p>
                  </div>

                  {/* ── Import result summary ── */}
                  {importResult && (
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: t("leads.upload.saved", "Saved"), value: importResult.savedCount, color: "text-green-500" },
                        { label: t("leads.upload.updated", "Updated"), value: importResult.updatedCount, color: "text-blue-500" },
                        { label: t("leads.upload.skipped", "Skipped"), value: importResult.skippedCount, color: "text-yellow-500" },
                        { label: t("leads.upload.total", "Total"), value: importResult.totalProcessed, color: "text-[var(--color-text-primary)]" },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-border)] p-3 text-center"
                        >
                          <p className={`text-xl font-black ${color}`}>{value}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)] flex justify-end gap-3 shrink-0">
              <button
                id="csv-upload-cancel"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                disabled={isUploading}
              >
                {importResult ? t("common.close", "Close") : t("common.cancel", "Cancel")}
              </button>
              {!importResult && (
                <button
                  id="csv-upload-submit"
                  onClick={handleUpload}
                  disabled={!file || parsedData.length === 0 || isUploading}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t("common.processing", "Processing...")}
                    </>
                  ) : (
                    t("leads.upload.confirm", "Import Leads")
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
