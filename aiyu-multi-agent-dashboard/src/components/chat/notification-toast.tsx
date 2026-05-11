"use client";

import { memo, useEffect } from "react";
import { useWs } from "@/lib/ws-context";
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from "lucide-react";

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  error: "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400",
  warning: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400",
  info: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400",
};

export const NotificationToast = memo(function NotificationToast() {
  const notifications = useWs(s => s.notifications);
  const dismissNotification = useWs(s => s.dismissNotification);

  const activeNotifications = notifications.filter(n => !n.dismissed).slice(-5);

  // Auto-dismiss after 5s
  useEffect(() => {
    if (activeNotifications.length === 0) return;
    const timers = activeNotifications.map(n =>
      setTimeout(() => dismissNotification(n.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [activeNotifications, dismissNotification]);

  if (activeNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {activeNotifications.map(n => {
        const Icon = iconMap[n.type];
        const colors = colorMap[n.type];
        return (
          <div
            key={n.id}
            className={`flex items-start gap-2.5 p-3 rounded-lg border shadow-lg animate-slide-in ${colors}`}
          >
            <Icon className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">{n.title}</p>
              <p className="text-[10px] opacity-80 truncate">{n.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(n.id)}
              className="shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
});
