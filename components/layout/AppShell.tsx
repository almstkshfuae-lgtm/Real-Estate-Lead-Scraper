"use client";

import { useState } from "react";
import NavSidebar from "./NavSidebar";
import TopBar from "./TopBar";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isRtl = i18n.language === "ar";

  return (
    <div className={`flex min-h-screen bg-[var(--color-bg-base)] ${isRtl ? 'font-cairo' : 'font-inter'}`}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Wrapper */}
      <div className={`
        fixed inset-y-0 inset-inline-start-0 z-50 lg:relative lg:z-auto transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')}
      `}>
        <NavSidebar />
        
        {/* Close button for mobile */}
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="absolute top-4 inset-inline-end-[-40px] p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
