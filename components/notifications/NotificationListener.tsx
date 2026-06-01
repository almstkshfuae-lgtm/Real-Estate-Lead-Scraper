"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  createdAt: string;
}

export default function NotificationListener() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const seenNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const authRes = await fetch("/api/auth/me");
        if (!authRes.ok) return;

        const res = await fetch("/api/settings/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (data.preferences?.pushNotifications) {
          if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
              toast.error("Browser notifications are blocked. Please allow notifications in your browser settings.");
              return;
            }
          }
          setPushEnabled(true);
        }
      } catch (error) {
        // Silent fail if not authenticated
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    if (!pushEnabled) return;

    let cancelled = false;

    const handleNotifications = async () => {
      try {
        const res = await fetch("/api/notifications?markRead=true");
        if (!res.ok) {
          if (res.status === 401) return;
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const notifications: NotificationItem[] = data.notifications || [];

        notifications.forEach((notification) => {
          if (seenNotifications.current.has(notification.id)) return;
          seenNotifications.current.add(notification.id);

          toast(messageFormatter(notification.title, notification.body), {
            description: notification.body,
            action: {
              label: "View",
              onClick: () => window.location.href = "/settings/notifications",
            },
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification(notification.title, {
              body: notification.body,
            });
          }
        });
      } catch (error) {
        // Silent fail
      }
    };

    const interval = window.setInterval(() => {
      if (!cancelled) {
        handleNotifications();
      }
    }, 15000);

    handleNotifications();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pushEnabled]);

  return null;
}

function messageFormatter(title: string, body: string) {
  return `${title}: ${body}`;
}
