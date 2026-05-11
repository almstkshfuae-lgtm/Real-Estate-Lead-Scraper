"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { Bot, Zap, TrendingUp, MessageSquare } from "lucide-react";

const AIChatPanel = dynamic(() => import("@/components/chat/AIChatPanel"), { ssr: false });

export default function AIChatPage() {
  const { t } = useTranslation("common");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            {t("ai.page.title", "AI Intelligence Hub")}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {t("ai.page.subtitle", "Multi-language AI assistant for UAE real estate agents · Powered by Claude")}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { icon: Zap, label: t("ai.page.stat1", "Real-time Streaming"), color: "text-amber-600 bg-amber-50" },
            { icon: TrendingUp, label: t("ai.page.stat2", "Lead Intelligence"), color: "text-emerald-600 bg-emerald-50" },
            { icon: MessageSquare, label: t("ai.page.stat3", "EN / AR Bilingual"), color: "text-violet-600 bg-violet-50" },
          ].map(({ icon: Icon, label, color }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${color}`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        <AIChatPanel />
      </div>
    </div>
  );
}
