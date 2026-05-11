"use client";

import { ReactNode } from "react";
import "@/lib/i18n"; // Initialize i18n
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export default function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Sync HTML dir attribute
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  if (!mounted) return null;

  return <>{children}</>;
}
