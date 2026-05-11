import type { Metadata } from "next";
import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import I18nProvider from "@/components/I18nProvider";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "Brilliance - UAE Real Estate Lead Scraper",
  description: "AI-powered real estate lead intelligence platform for UAE agents.",
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
        </I18nProvider>
      </body>
    </html>
  );
}
