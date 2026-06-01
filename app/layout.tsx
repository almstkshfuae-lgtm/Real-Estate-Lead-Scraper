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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`${inter.variable} ${cairo.variable}`}>
      <body className="font-inter antialiased">
        <I18nProvider>
          {children}
          <NotificationListener />
          <SWRegister />
          <Toaster position="top-right" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
