"use client";

import {
  X, Building2, MapPin, Calendar, CreditCard, Box,
  ExternalLink, Loader2, Trash2, Edit2, CheckCircle2, Image as ImageIcon
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";
import { AREA_TRANSLATIONS } from "@/lib/areas";

export default function ProjectSidebar({ project, onClose }: { project: any | null; onClose: () => void }) {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";

  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    projectName: "",
    location: "",
    developer: "",
    startingPrice: "",
    handoverDate: "",
    propertyType: "",
    areaSqft: "",
    latitude: "",
    longitude: "",
    imageUrl: "",
    sourceUrl: ""
  });

  useEffect(() => {
    if (project) {
      setEditForm({
        projectName: project.projectName || project.name || "",
        location: project.location || "",
        developer: project.developer || "",
        startingPrice: project.startingPrice?.toString() || "",
        handoverDate: project.handoverDate || project.handover || "",
        propertyType: project.propertyType || "",
        areaSqft: project.areaSqft?.toString() || project.area || "",
        latitude: project.latitude?.toString() || project.lat?.toString() || "",
        longitude: project.longitude?.toString() || project.lng?.toString() || "",
        imageUrl: project.imageUrl || "",
        sourceUrl: project.sourceUrl || ""
      });
      setIsEditing(false);
    }
  }, [project]);

  if (!project) return null;

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data.error || "Failed to update project");
      }

      toast.success(t("projects.updateSuccess", "Project updated successfully"));
      setIsEditing(false);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("projects.confirmDelete", { name: project.projectName || project.name, defaultValue: `Are you sure you want to delete ${project.projectName || project.name}?` }))) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await safeJson(res).catch(() => ({} as any));
        throw new Error(data.error || "Failed to delete project");
      }

      toast.success(t("projects.deleteSuccess", "Project deleted successfully"));
      onClose();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number | string) => {
    const tbaText = isRtl ? "قريباً" : "TBA";
    if (!price) return tbaText;
    const num = Number(price);
    if (isNaN(num)) return price;
    if (num >= 1000000) {
      const formatted = (num / 1000000).toFixed(2);
      return isRtl ? `${formatted} مليون د.إ` : `AED ${formatted}M`;
    }
    return isRtl ? `${num.toLocaleString()} د.إ` : `AED ${num.toLocaleString()}`;
  };

  const displayDeveloper = project.developer 
    ? (t(`developers.${project.developer.toLowerCase().replace(/[^a-z0-9]/g, "")}`, project.developer) as string)
    : (t("projects.developerTba", "Developer TBA") as string);

  const displayLocation = project.location 
    ? (isRtl ? (AREA_TRANSLATIONS[project.location] || project.location) : project.location) 
    : (t("common.uae", "UAE") as string);

  const rawHandover = project.handoverDate || project.handover;
  const displayHandover = rawHandover 
    ? (rawHandover === "TBA" ? (t("common.tba", "TBA") as string) : rawHandover)
    : (t("common.tba", "TBA") as string);

  return (
    <div className="fixed inset-y-0 inset-inline-end-0 w-full sm:max-w-md bg-[var(--color-bg-card)] shadow-2xl border-inline-start border-[var(--color-border)] z-[1000] flex flex-col transition-all duration-300 animate-in slide-in-from-inline-end">
      {/* Header */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-start justify-between bg-[var(--color-bg-surface)]/50">
        <div className="flex-1 text-start">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{project.projectName || project.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-1 bg-[#D1FAE5] text-[#059669] text-xs font-bold rounded-md">
              {formatPrice(project.startingPrice)}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] font-medium">
              {displayDeveloper}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
              title={t("common.edit", "Edit")}
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5 text-start">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.name", "Project Name")}</label>
              <input
                type="text"
                required
                value={editForm.projectName}
                onChange={(e) => setEditForm({ ...editForm, projectName: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.developer", "Developer")}</label>
                <input
                  type="text"
                  value={editForm.developer}
                  onChange={(e) => setEditForm({ ...editForm, developer: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.price", "Starting Price")}</label>
                <input
                  type="number"
                  value={editForm.startingPrice}
                  onChange={(e) => setEditForm({ ...editForm, startingPrice: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.location", "Location")}</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.handover", "Handover Date")}</label>
                <input
                  type="text"
                  value={editForm.handoverDate}
                  onChange={(e) => setEditForm({ ...editForm, handoverDate: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.propertyType", "Property Type")}</label>
                <input
                  type="text"
                  value={editForm.propertyType}
                  onChange={(e) => setEditForm({ ...editForm, propertyType: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.area", "Area")}</label>
                <input
                  type="number"
                  value={editForm.areaSqft}
                  onChange={(e) => setEditForm({ ...editForm, areaSqft: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.latitude", "Latitude")}</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
              <div className="space-y-1.5 text-start">
                <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.longitude", "Longitude")}</label>
                <input
                  type="number"
                  step="any"
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5 text-start">
              <label className="text-xs font-bold text-[var(--color-text-secondary)]">{t("projects.fields.imageUrl", "Image URL")}</label>
              <input
                type="text"
                value={editForm.imageUrl}
                onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all"
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-bold rounded-xl hover:bg-[var(--color-bg-card)] transition-all"
              >
                {t("common.cancel", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white font-bold rounded-xl hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("common.saveChanges", "Save Changes")}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Image */}
            {project.imageUrl && (
              <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 relative group">
                <img 
                  src={project.imageUrl} 
                  alt={project.projectName} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => { (e.target as any).style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <Building2 className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("projects.fields.developer", "Developer")}</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{displayDeveloper}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <MapPin className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("projects.fields.location", "Location")}</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{displayLocation}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <Calendar className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("projects.fields.handover", "Handover")}</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{displayHandover}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start">
                <Box className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("projects.fields.area", "Area (Sqft)")}</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{project.areaSqft || project.area || '-'}</p>
              </div>
              <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-start col-span-2">
                <CreditCard className="w-4 h-4 text-[var(--color-text-secondary)] mb-2" />
                <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">{t("projects.fields.price", "Starting Price")}</p>
                <p className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{formatPrice(project.startingPrice)}</p>
              </div>
            </div>

            {/* Links */}
            {project.sourceUrl && (
              <a 
                href={project.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors"
              >
                {t("projects.visitSource", "Visit Project Source")}
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {/* Delete Area */}
            <div className="pt-6 border-t border-[var(--color-border)]">
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {t("projects.deleteProject", "Delete Project")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
