"use client";

import { useEffect, useState } from "react";
import { Bell, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  createdAt: string;
  read: boolean;
};

export default function NotificationsPage() {
  const { t } = useTranslation("common");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error(t("notifications.fetchError", "Unable to load notifications."));
    } finally {
      setIsLoading(false);
    }
  };

  const markAllRead = async () => {
    setIsUpdating(true);

    try {
      const res = await fetch("/api/notifications?markRead=true", { method: "GET" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await fetchNotifications();
      toast.success(t("notifications.markedRead", "All notifications marked as read."));
    } catch (error) {
      console.error("Failed to mark notifications read:", error);
      toast.error(t("notifications.saveError", "Unable to update notifications."));
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[var(--color-primary-subtle)] text-[var(--color-primary)]">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t("notifications.title", "Notifications")}
            </h1>
            <p className="text-[var(--color-text-secondary)]">
              {t("notifications.subtitle", "Review your latest alerts and activity.")}
            </p>
          </div>
        </div>

        <button
          onClick={markAllRead}
          disabled={isLoading || isUpdating}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-hover)] transition-all disabled:opacity-60"
        >
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {t("notifications.markAllRead", "Mark all as read")}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-72">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center">
          <XCircle className="mx-auto mb-4 w-10 h-10 text-[var(--color-text-secondary)]" />
          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("notifications.empty", "No unread notifications.")}
          </p>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {t("notifications.emptyDesc", "You’ll see notifications here when new activity arrives.")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{notification.title}</p>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{notification.body}</p>
                </div>
                <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
