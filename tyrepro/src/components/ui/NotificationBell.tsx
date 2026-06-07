"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, RefreshCw, ChevronDown, ChevronUp, X } from "lucide-react";
import { useNotifications, ALERT_ICONS, ALERT_COLORS } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ALERT_LINKS: Record<string, string> = {
  cheque_due_soon: "/dashboard/cheques",
  cheque_overdue:  "/dashboard/cheques",
  low_stock:       "/dashboard/inventory",
  out_of_stock:    "/dashboard/inventory",
  uc_not_sent:     "/dashboard/uc-returns",
  ceat_overdue:    "/dashboard/uc-returns",
};

export function NotificationBell() {
  const { notifications, totalCount, hasNew, loading, markAsSeen, refreshAlerts } = useNotifications();
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleOpen() {
    setOpen(v => !v);
    if (!open) markAsSeen();
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refreshAlerts();
    setRefreshing(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
          open ? "border-brand-300 bg-brand-50" : "border-gray-200 bg-white hover:bg-gray-50"
        )}
        title="Notifications"
      >
        <Bell className={cn("h-4 w-4", open ? "text-brand-600" : "text-gray-500")} />

        {/* Red dot — shows when there are new unread alerts */}
        {hasNew && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}

        {/* Pulsing ring when new */}
        {hasNew && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-400 animate-ping opacity-60" />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Notifications</p>
              <p className="text-xs text-gray-500">
                {totalCount > 0 ? `${totalCount} active alert${totalCount > 1 ? "s" : ""}` : "All clear"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
                title="Refresh alerts"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-gray-500", refreshing && "animate-spin")} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-sm font-medium text-gray-700">All clear!</p>
                <p className="text-xs text-gray-400 mt-1">No alerts at the moment</p>
                <button
                  onClick={handleRefresh}
                  className="mt-3 text-xs text-brand-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Check now
                </button>
              </div>
            )}

            {!loading && notifications.map(alert => {
              const colorClass = ALERT_COLORS[alert.type] ?? "text-gray-700 bg-gray-50 border-gray-200";
              const icon       = ALERT_ICONS[alert.type] ?? "🔔";
              const link       = ALERT_LINKS[alert.type];
              const isExpanded = expanded === alert.type;

              return (
                <div key={alert.type} className={cn("border-b border-gray-50 last:border-0")}>
                  <div className={cn("px-4 py-3 border-l-4", colorClass.split(" ").slice(1).join(" "),
                    "border-l-current"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-base flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-semibold", colorClass.split(" ")[0])}>
                            {alert.count} × {alert.message}
                          </p>
                          {isExpanded && (
                            <ul className="mt-2 space-y-1">
                              {alert.items.map((item, i) => (
                                <li key={i} className={cn("text-xs opacity-80", colorClass.split(" ")[0])}>
                                  • {item}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setExpanded(isExpanded ? null : alert.type)}
                        className="flex-shrink-0 mt-0.5"
                      >
                        {isExpanded
                          ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                      </button>
                    </div>

                    {link && (
                      <Link
                        href={link}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "mt-2 inline-block text-xs underline underline-offset-2 font-medium",
                          colorClass.split(" ")[0]
                        )}
                      >
                        View →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-center">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs text-brand-600 hover:underline flex items-center gap-1 mx-auto"
              >
                <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                {refreshing ? "Checking..." : "Refresh alerts"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}