import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import I18nProvider from "@/components/I18nProvider";
import NotificationListener from "@/components/notifications/NotificationListener";
import SWRegister from "@/components/SWRegister";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-cairo",
  preload: false,
});

export const metadata: Metadata = {
  title: "Brilliance - UAE Real Estate Lead Scraper",
  description: "AI-powered real estate lead intelligence platform for UAE agents.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Brilliance",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#185FA5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  let lang = cookieStore.get('i18next')?.value;

  if (!lang) {
    const session = await getSession();
    if (session && session.language) {
      lang = session.language;
    }
  }

  lang = lang || 'en';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={lang} dir={dir} className={`${inter.variable} ${cairo.variable}`}>
      <body className={`antialiased ${lang === 'ar' ? 'font-cairo' : 'font-inter'}`}>
        <I18nProvider initialLang={lang}>
          {children}
          <NotificationListener />
          <SWRegister />
          <Toaster position="top-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
