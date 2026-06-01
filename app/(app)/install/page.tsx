"use client";

import React, { useState, useEffect } from "react";
import { Download, Share, Smartphone, Monitor, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function InstallPage() {
  const { t } = useTranslation('common');
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>('desktop');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

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

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log("[PWA] captured beforeinstallprompt event");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error(t('install.notSupported', 'Browser installation not available. Try adding to home screen manually.'));
      return;
    }
    
    // Show Chrome prompt
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);
    
    if (outcome === 'accepted') {
      toast.success(t('install.success', 'Brilliance is installing!'));
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const apkUrl = process.env.NEXT_PUBLIC_APK_DOWNLOAD_URL || "https://brilliance-vercel-blob.public.blob.vercel-storage.com/downloads/brilliance.apk";

  return (
    <div className="min-h-screen bg-[var(--color-bg-surface)] py-12 px-6">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--color-primary)] text-white shadow-xl shadow-[var(--color-primary)]/20 mb-4 animate-bounce">
            <Smartphone className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
            {t('install.title', 'Install Brilliance')}
          </h1>
          <p className="text-[var(--color-text-secondary)] text-lg">
            {t('install.subtitle', 'Access the UAE\'s most powerful lead scraper and intelligence tool directly from your home screen.')}
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
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Android Device Detected</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Choose one of the premium install methods below.</p>
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                {isInstallable && (
                  <button 
                    onClick={handleInstallClick}
                    className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--color-primary)]/20"
                  >
                    <Smartphone className="w-5 h-5" />
                    One-Click Web Install
                  </button>
                )}

                <a 
                  href={apkUrl}
                  download
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/20 text-center"
                >
                  <Download className="w-5 h-5" />
                  Download Android APK
                </a>
                
                <p className="text-xs text-center text-[var(--color-text-secondary)] flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                  Note: You may need to enable "Install from unknown sources" in settings.
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
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">iOS Device Detected (iPhone/iPad)</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Add to your home screen via Safari browser.</p>
                </div>
              </div>

              <div className="space-y-6">
                {[
                  { step: 1, text: "Open this page in Safari browser (Chrome/Firefox not supported)" },
                  { step: 2, text: "Tap the Share button at the bottom of the screen" },
                  { step: 3, text: "Scroll down the menu and tap 'Add to Home Screen'" },
                  { step: 4, text: "Tap 'Add' in the top-right corner to confirm" }
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-text-primary)] shrink-0">
                      {item.step}
                    </div>
                    <p className="text-[var(--color-text-primary)] font-medium pt-1.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {device === 'desktop' && (
            <div className="p-8 rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-8 text-center shadow-md">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[var(--color-primary)] flex items-center justify-center mb-2">
                  <Monitor className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Desktop App</h2>
                <p className="text-[var(--color-text-secondary)]">
                  Scan this QR code with your smartphone to install, or use direct web installation below.
                </p>
              </div>

              {isInstallable ? (
                <div className="space-y-4">
                  <button 
                    onClick={handleInstallClick}
                    className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-bold text-lg hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[var(--color-primary)]/20"
                  >
                    <Smartphone className="w-5 h-5" />
                    Install App directly on Desktop
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 space-y-4">
                  <div className="p-6 bg-white rounded-3xl shadow-inner border border-gray-100">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 bg-gray-50 flex items-center justify-center text-gray-300">
                        Generating QR Code...
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)]">Scan to share with your mobile device</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Benefits Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            "Real-time lead notifications",
            "Offline data access & fallback screen",
            "Significantly faster rendering and load speeds",
            "Standalone, native application feel"
          ].map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 p-4 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
