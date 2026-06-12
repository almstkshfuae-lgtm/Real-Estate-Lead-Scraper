"use client";

import { useState, useEffect } from "react";
import { isAdmin } from "@/lib/roles";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Map as MapIcon, 
  Search, 
  Megaphone, 
  Settings, 
  LogOut,
  ShieldCheck,
  Bot
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NavSidebar() {
  const pathname = usePathname();
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";
  const [userRole, setUserRole] = useState<string | null>(null);
  const isAdminUser = isAdmin(userRole || undefined);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.user) {
          setUserRole(data.user.role || "agent");
        }
      })
      .catch(err => console.error("Error loading user in NavSidebar:", err));
  }, []);

  const navItems = [
    { name: t('nav.leads', 'Leads'), href: "/leads", icon: Users },
    { name: t('nav.map', 'Map View'), href: "/map", icon: MapIcon },
    { name: t('nav.aiChat', 'AI Assistant'), href: "/ai-chat", icon: Bot, badge: t('nav.new', 'NEW') },
    { name: t('nav.search', 'Intelligence Scrape'), href: "/search", icon: Search },
    { name: t('nav.campaigns', 'Campaigns'), href: "/campaigns", icon: Megaphone },
  ];

  return (
    <aside className="w-64 bg-[var(--color-bg-card)] border-e border-[var(--color-border)] flex flex-col h-screen sticky top-0 transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[var(--color-primary)] rounded-lg flex items-center justify-center shrink-0">
          <ShieldCheck className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold text-[var(--color-text-primary)] truncate">Brilliance</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between p-3 rounded-xl transition-all group ${
                isActive 
                  ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]" 
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? "text-[var(--color-primary)]" : "group-hover:text-[var(--color-primary)]"}`} />
                <span className="font-medium text-sm">{item.name}</span>
                {(item as any).badge && !isActive && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[9px] font-bold leading-none">
                    {(item as any).badge}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="w-1.5 h-5 bg-[var(--color-primary)] rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)] space-y-2">
        {isAdminUser && (
          <Link
            href="/settings/users"
            className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
              pathname === '/settings/users' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium text-sm">{isRtl ? "إدارة المستخدمين" : "User Management"}</span>
          </Link>
        )}
        <Link
          href="/settings/profile"
          className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
            pathname === '/settings/profile' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium text-sm">{t('nav.settings', 'Profile Settings')}</span>
        </Link>
        <Link
          href="/settings/notifications"
          className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
            pathname === '/settings/notifications' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <span className="font-medium text-sm">{t('nav.notifications', 'Notifications')}</span>
        </Link>
        {isAdminUser && (
          <Link
            href="/settings/integrations"
            className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
              pathname === '/settings/integrations' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>
            <span className="font-medium text-sm">{t('nav.integrations', 'Integrations')}</span>
          </Link>
        )}
        <Link
          href="/settings/scraper"
          className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
            pathname === '/settings/scraper' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="font-medium text-sm">{t('nav.scraperSettings', 'Scraper Settings')}</span>
        </Link>
        {isAdminUser && (
          <>
            <Link
              href="/settings/export"
              className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
                pathname === '/settings/export' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span className="font-medium text-sm">{t('nav.exportHistory', 'Export History')}</span>
            </Link>
            <Link
              href="/settings/projects"
              className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
                pathname === '/settings/projects' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
              }`}
            >
              <MapIcon className="w-5 h-5" />
              <span className="font-medium text-sm">{t('nav.projects', 'Manage Projects')}</span>
            </Link>
          </>
        )}
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-[var(--color-danger)] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">{t('nav.logout', 'Sign Out')}</span>
        </button>
      </div>
    </aside>
  );
}
