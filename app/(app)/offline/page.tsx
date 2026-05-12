"use client";

import React from "react";
import { WifiOff, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function OfflinePage() {
  const { t } = useTranslation('common');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg-surface)] px-6 text-center">
      <div className="w-24 h-24 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-8 animate-pulse">
        <WifiOff className="w-12 h-12" />
      </div>

      <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">
        {t('offline.title', 'You are Offline')}
      </h1>

      <p className="text-[var(--color-text-secondary)] mb-12 max-w-md mx-auto text-lg">
        {t('offline.subtitle', 'It looks like your internet connection is down. Some features may be limited, but you can still view your last cached leads.')}
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
        <button
          onClick={() => window.location.reload()}
          className="flex-1 py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--color-primary)]/20"
        >
          <RotateCcw className="w-5 h-5" />
          {t('common.retry', 'Retry Connection')}
        </button>

        <Link
          href="/"
          className="flex-1 py-4 bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-2xl font-bold hover:bg-[var(--color-bg-surface)] transition-all flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          {t('common.home', 'Go Home')}
        </Link>
      </div>
    </div>
  );
}
