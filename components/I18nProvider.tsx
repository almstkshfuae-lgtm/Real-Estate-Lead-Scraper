"use client";

import { ReactNode } from "react";
import "@/lib/i18n"; // Initialize i18n
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export default function I18nProvider({ 
  children,
  initialLang,
}: { 
  children: ReactNode;
  initialLang: string;
}) {
  const { i18n } = useTranslation();

  // Synchronize client-side language with server-detected locale immediately during rendering
  if (initialLang && i18n.language !== initialLang) {
    i18n.changeLanguage(initialLang);
  }

  useEffect(() => {
    // Sync HTML dir and lang attributes on dynamic language switches
    const dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return <>{children}</>;
}
