"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, MapPin, Loader2, Image as ImageIcon, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Project {
  id: string;
  projectName: string;
  location: string;
  developer: string | null;
  startingPrice: number | null;
  areaSqft: number | null;
  handover: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
}

export default function ProjectsSettingsPage() {
  const { t, i18n } = useTranslation("common");
  const isRtl = i18n.language === "ar";
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/projects/heatmap");
      const data = await res.json();
      if (data.projects) setProjects(data.projects);
    } catch (error) {
      console.error("Failed to load projects", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (proj: Project) => {
    setEditingProject(proj);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingProject({
      id: "",
      projectName: "",
      location: "",
      developer: "",
      startingPrice: null,
      areaSqft: null,
      handover: "",
      lat: null,
      lng: null,
      imageUrl: "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      fetchProjects();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    
    setIsSaving(true);
    try {
      const isNew = !editingProject.id;
      const url = isNew ? "/api/projects" : `/api/projects/${editingProject.id}`;
      const method = isNew ? "POST" : "PATCH";
      
      const payload = {
        projectName: editingProject.projectName,
        location: editingProject.location,
        developer: editingProject.developer,
        startingPrice: editingProject.startingPrice,
        areaSqft: editingProject.areaSqft,
        handoverDate: editingProject.handover,
        latitude: editingProject.lat,
        longitude: editingProject.lng,
        imageUrl: editingProject.imageUrl,
      };

      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      setIsModalOpen(false);
      fetchProjects();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && editingProject) {
        setEditingProject({ ...editingProject, imageUrl: data.url });
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Manage Projects</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Add and manage real estate projects to display on the Geo-Intelligence Map.
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-start">
            <thead className="bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-start">Project Name</th>
                <th className="px-6 py-4 text-start">Location</th>
                <th className="px-6 py-4 text-start">Developer</th>
                <th className="px-6 py-4 text-start">Price / Area</th>
                <th className="px-6 py-4 text-start">Image</th>
                <th className="px-6 py-4 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-secondary)]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[var(--color-text-secondary)]">
                    No projects found.
                  </td>
                </tr>
              ) : (
                projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-[var(--color-bg-surface)] transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--color-text-primary)]">
                      {proj.projectName}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {proj.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {proj.developer || "-"}
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      <div>{proj.startingPrice ? `${proj.startingPrice.toLocaleString()} AED` : "-"}</div>
                      <div className="text-xs opacity-70">{proj.areaSqft ? `${proj.areaSqft} sqft` : "-"}</div>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">
                      {proj.imageUrl ? (
                        <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={proj.imageUrl} alt="" className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-[var(--color-bg-surface)] flex items-center justify-center border border-[var(--color-border)]">
                          <ImageIcon className="w-4 h-4 opacity-50" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(proj)}
                          className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)] rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(proj.id)}
                          className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && editingProject && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-surface)]">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                {editingProject.id ? "Edit Project" : "Add New Project"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-5 overflow-y-auto flex-1 space-y-5">
              {/* Image Upload Section */}
              <div>
                <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Project Image
                </label>
                <div className="flex items-center gap-4">
                  {editingProject.imageUrl ? (
                    <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-[var(--color-border)] shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editingProject.imageUrl} alt="Project" className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="w-32 h-24 rounded-lg bg-[var(--color-bg-surface)] border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-1 text-[var(--color-text-secondary)]">
                      <ImageIcon className="w-6 h-6 opacity-50" />
                      <span className="text-[10px] font-medium">No image</span>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <label className="relative cursor-pointer flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl text-sm font-bold transition-all w-fit shadow-sm">
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {isUploading ? "Uploading..." : "Upload New Image"}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                        disabled={isUploading}
                      />
                    </label>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                      Recommended size: 800x400px. JPG or PNG.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Project Name</label>
                  <input
                    type="text"
                    required
                    value={editingProject.projectName}
                    onChange={(e) => setEditingProject({ ...editingProject, projectName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Developer</label>
                  <input
                    type="text"
                    value={editingProject.developer || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, developer: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Location</label>
                  <input
                    type="text"
                    required
                    value={editingProject.location}
                    onChange={(e) => setEditingProject({ ...editingProject, location: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Handover Date</label>
                  <input
                    type="text"
                    value={editingProject.handover || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, handover: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                    placeholder="e.g. Q4 2026"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Starting Price (AED)</label>
                  <input
                    type="number"
                    value={editingProject.startingPrice || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, startingPrice: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Area (Sqft)</label>
                  <input
                    type="number"
                    value={editingProject.areaSqft || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, areaSqft: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingProject.lat || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, lat: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-secondary)] mb-1 uppercase tracking-wider">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editingProject.lng || ""}
                    onChange={(e) => setEditingProject({ ...editingProject, lng: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
              
              <div className="pt-4 border-t border-[var(--color-border)] flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] rounded-xl text-sm font-bold border border-[var(--color-border)] hover:bg-[var(--color-bg-card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold hover:bg-opacity-90 transition-all shadow-md disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
