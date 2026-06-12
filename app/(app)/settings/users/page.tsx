"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isAdmin } from "@/lib/roles";
import { Users, UserPlus, Trash2, Shield, Mail, KeyRound, Loader2, Save, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { safeJson } from "@/lib/safe-fetch";

type SystemUser = {
  id: string;
  email: string;
  name: string;
  nameAr?: string | null;
  role: string;
  createdAt: string;
};

export default function UserManagementPage() {
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/settings/users");
      if (res.status === 401) {
        window.location.href = "/leads";
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
      toast.error(t("settings.users.loadError", "Failed to load users list."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error(t("settings.users.missingFields", "All fields are required."));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await safeJson(res).catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      toast.success(t("settings.users.createSuccess", "User created successfully."));
      // Clear form
      setName("");
      setEmail("");
      setPassword("");
      setRole("agent");
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmMsg = isRtl 
      ? `هل أنت متأكد من رغبتك في حذف المستخدم ${userName}؟` 
      : `Are you sure you want to delete user ${userName}?`;
      
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(userId);
    try {
      const res = await fetch(`/api/settings/users?id=${userId}`, {
        method: "DELETE",
      });

      const data = await safeJson(res).catch(() => ({} as any));

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user");
      }

      toast.success(t("settings.users.deleteSuccess", "User deleted successfully."));
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl" dir={isRtl ? "rtl" : "ltr"}>
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {isRtl ? "إدارة المستخدمين" : "User Management"}
        </h1>
        <p className="text-text-secondary">
          {isRtl ? "إضافة وحذف وإدارة حسابات المستخدمين والوكلاء في التطبيق." : "Add, remove, and manage user and agent accounts in the system."}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1.2fr] gap-8">
        {/* Left Column: Users List */}
        <div className="space-y-6">
          <section className="p-6 rounded-3xl border border-border bg-bg-card space-y-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">
                  {isRtl ? "المستخدمون الحاليون" : "Current Users"}
                </h2>
                <p className="text-sm text-text-secondary">
                  {isRtl ? "عرض وإدارة حسابات الوكلاء النشطة." : "View and manage active agent accounts."}
                </p>
              </div>
            </div>

            <div className="divide-y divide-border overflow-hidden">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-subtle flex items-center justify-center text-primary font-bold">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text-primary flex items-center gap-2">
                        {isRtl && u.nameAr ? u.nameAr : u.name}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          isAdmin(u.role) 
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}>
                          {u.role}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {u.email}
                      </div>
                      <div className="text-[10px] text-text-disabled mt-1">
                        {isRtl ? "انضم في:" : "Joined:"} {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteUser(u.id, u.name)}
                    disabled={deletingId === u.id}
                    className="p-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 rounded-xl transition-all disabled:opacity-50"
                    title={isRtl ? "حذف المستخدم" : "Delete User"}
                  >
                    {deletingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Add User Form */}
        <aside className="space-y-6">
          <div className="p-6 rounded-3xl border border-border bg-bg-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">
                  {isRtl ? "إضافة مستخدم" : "Add User"}
                </h3>
                <p className="text-sm text-text-secondary">
                  {isRtl ? "إنشاء حساب وكيل جديد." : "Create a new agent account."}
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <label className="block space-y-1.5 text-xs font-bold text-text-secondary">
                <span>{isRtl ? "الاسم الكامل" : "Full Name"}</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                  placeholder={isRtl ? "مثال: عمر المنصوري" : "e.g. Omar Al Mansouri"}
                />
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-text-secondary">
                <span>{isRtl ? "البريد الإلكتروني" : "Email Address"}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                  placeholder="name@brilliance-lead.uk"
                />
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-text-secondary">
                <span>{isRtl ? "كلمة المرور" : "Password"}</span>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2.5 ps-9 text-sm text-text-primary focus:outline-none focus:border-primary"
                    placeholder="••••••••"
                  />
                  <KeyRound className="w-4 h-4 text-text-secondary absolute start-3 top-3" />
                </div>
              </label>

              <label className="block space-y-1.5 text-xs font-bold text-text-secondary">
                <span>{isRtl ? "الصلاحية" : "Role"}</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="agent">{isRtl ? "وكيل (Agent)" : "Agent"}</option>
                  <option value="admin">{isRtl ? "مسؤول (Admin)" : "Admin"}</option>
                </select>
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all disabled:opacity-50 mt-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isSaving ? t('common.saving', 'Saving...') : (isRtl ? "حفظ الحساب" : "Save Account")}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
