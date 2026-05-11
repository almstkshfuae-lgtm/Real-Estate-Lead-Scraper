"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  Map as MapIcon, 
  Search, 
  Megaphone, 
  Settings, 
  LogOut,
  ShieldCheck
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function NavSidebar() {
  const pathname = usePathname();
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.language === "ar";

  const navItems = [
    { name: t('nav.leads', 'Leads'), href: "/leads", icon: Users },
    { name: t('nav.map', 'Map View'), href: "/map", icon: MapIcon },
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
              </div>
              {isActive && (
                <div className="w-1.5 h-5 bg-[var(--color-primary)] rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--color-border)] space-y-2">
        <Link
          href="/settings/profile"
          className={`flex items-center gap-3 p-3 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-all ${
            pathname.startsWith('/settings') ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]' : ''
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium text-sm">{t('nav.settings', 'Settings')}</span>
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-[var(--color-danger)] hover:bg-red-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">{t('nav.logout', 'Sign Out')}</span>
        </button>
      </div>
    </aside>
  );
}
