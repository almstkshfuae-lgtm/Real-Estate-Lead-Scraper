"use client";

import { useEffect } from "react";

export default function SWRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Force unregister all old service workers to fix corrupted 503 states
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let reg of registrations) {
          reg.unregister();
          console.log("[PWA] Unregistered old Service Worker");
        }
        
        const registerSW = () => {
          navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => {
              console.log("[PWA] Service Worker registered with scope:", reg.scope);
              reg.update(); // Force check for updates
            })
            .catch((err) => {
              console.error("[PWA] Service Worker registration failed:", err);
            });
        };

        if (document.readyState === "complete") {
          registerSW();
        } else {
          window.addEventListener("load", registerSW);
        }
      });
    }
  }, []);

  return null;
}
