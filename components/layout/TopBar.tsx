"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Globe, Bell, User, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const { t, i18n } = useTranslation('common');
  const [theme, setTheme] = useState("light");
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    document.documentElement.setAttribute("data-theme", savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(nextLang);
  };

  const isRtl = i18n.language === "ar";

  return (
    <header className="h-16 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] lg:hidden transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-widest hidden sm:block">
          {t('nav.dashboard')}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleLanguage}
          className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors flex items-center gap-2"
          title={isRtl ? "تغيير اللغة" : "Change Language"}
        >
          <Globe className="w-5 h-5" />
          <span className="text-xs font-bold uppercase">{i18n.language === 'en' ? 'AR' : 'EN'}</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-colors"
          title={isRtl ? "تغيير المظهر" : "Change Theme"}
        >
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => router.push('/notifications')}
          className="p-2 rounded-full hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] relative transition-colors"
          title={t('nav.notifications')}
          aria-label={t('nav.notifications')}
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 inset-inline-end-2 w-2 h-2 bg-[var(--color-danger)] rounded-full border-2 border-[var(--color-bg-card)]"></span>
        </button>

        <div className="h-8 w-px bg-[var(--color-border)] mx-2"></div>

        <div className="relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className={`flex items-center gap-3 p-1.5 ps-3 rounded-full transition-all ${showDropdown ? 'bg-[var(--color-bg-surface)]' : 'hover:bg-[var(--color-bg-surface)]'}`}
          >
            <div className="text-end hidden sm:block">
              <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">Agent Smith</p>
              <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">Premium Agent</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary)] font-bold">
              <User className="w-5 h-5" />
            </div>
          </button>

          {showDropdown && (
            <div className={`absolute top-full mt-2 inset-inline-end-0 w-48 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100 ${isRtl ? 'text-right' : 'text-left'}`}>
              <button className="w-full flex items-center gap-2 p-3 rounded-xl text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-all">
                <User className="w-4 h-4" />
                {t('nav.settings')}
              </button>
              <div className="h-px bg-[var(--color-border)] my-1"></div>
              <button 
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="w-full flex items-center gap-2 p-3 rounded-xl text-sm font-medium text-[var(--color-danger)] hover:bg-red-50 transition-all"
              >
                <Globe className="w-4 h-4" />
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
