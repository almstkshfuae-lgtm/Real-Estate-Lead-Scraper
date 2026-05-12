"use client";

import React, { useState, useEffect } from "react";
import { Download, Share, Smartphone, Monitor, ChevronRight, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

export default function InstallPage() {
  const { t } = useTranslation('common');
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDevice('ios');
    } else if (/android/.test(ua)) {
      setDevice('android');
    } else {
      setDevice('desktop');
    }

    // Generate QR code for current URL
    const currentUrl = typeof window !== "undefined" ? window.location.href : "";
    if (currentUrl) {
      QRCode.toDataURL(currentUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: "#185FA5",
          light: "#FFFFFF",
        },
      }).then(url => setQrCodeUrl(url))
        .catch(err => console.error("QR Code error:", err));
    }
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary)] text-white shadow-xl shadow-[var(--color-primary)]/20 mb-4">
            <Smartphone className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            {t('install.title', 'Install Brilliance')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-lg">
            {t('install.subtitle', 'Access the UAE\'s most powerful lead intelligence platform directly from your home screen.')}
          </p>
        </div>

        {/* Device Specific Panels */}
        <div className="space-y-6">
          {device === 'android' && (
            <div className="p-8 rounded-3xl border-2 border-[var(--color-primary)] bg-[var(--color-bg-card)] shadow-lg space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Android Installation</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Recommended for full background features.</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <button className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-3">
                  <Download className="w-5 h-5" />
                  Download APK
                </button>
                <p className="text-xs text-center text-[var(--color-text-secondary)]">
                  Note: You may need to enable "Install from unknown sources" in your settings.
                </p>
              </div>
            </div>
          )}

          {device === 'ios' && (
            <div className="p-8 rounded-3xl border-2 border-[#007AFF] bg-[var(--color-bg-card)] shadow-lg space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                  <Share className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">iOS (iPhone/iPad)</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Add to your home screen via Safari.</p>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { step: 1, text: "Open this page in Safari browser" },
                  { step: 2, text: "Tap the Share button at the bottom" },
                  { step: 3, text: "Scroll down and tap 'Add to Home Screen'" },
                  { step: 4, text: "Tap 'Add' to confirm" }
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-text-primary)]">
                      {item.step}
                    </div>
                    <p className="text-[var(--color-text-primary)] font-medium">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {device === 'desktop' && (
            <div className="p-8 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-8 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mb-2">
                  <Monitor className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Desktop App</h2>
                <p className="text-[var(--color-text-secondary)]">
                  Scan the QR code below on your mobile device to install the app.
                </p>
              </div>

              <div className="flex justify-center py-4">
                <div className="p-6 bg-white rounded-3xl shadow-inner border border-gray-100">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="w-48 h-48 bg-gray-50 flex items-center justify-center text-gray-300">
                      Generating...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "Real-time lead notifications",
            "Offline data access",
            "Faster performance",
            "Native experience"
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
