"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, RefreshCw, X, ArrowRight, CalendarClock, Package, RotateCcw, AlertTriangle } from "lucide-react";
import { useNotifications, ALERT_ICONS } from "@/hooks/useNotifications";
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

const ALERT_LINK_LABELS: Record<string, string> = {
  cheque_due_soon: "View cheques",
  cheque_overdue:  "View cheques",
  low_stock:       "View inventory",
  out_of_stock:    "View inventory",
  uc_not_sent:     "View UC returns",
  ceat_overdue:    "View UC returns",
};

const ALERT_ICON_MAP: Record<string, React.ElementType> = {
  cheque_due_soon: CalendarClock,
  cheque_overdue:  CalendarClock,
  low_stock:       Package,
  out_of_stock:    Package,
  uc_not_sent:     RotateCcw,
  ceat_overdue:    RotateCcw,
};

const ALERT_COLORS: Record<string, { bg: string; icon: string; badge: string; text: string; border: string }> = {
  cheque_due_soon: { bg: "bg-amber-50",  icon: "text-amber-700",  badge: "bg-amber-50 text-amber-800 border-amber-300",  text: "text-amber-800",  border: "border-amber-200" },
  cheque_overdue:  { bg: "bg-red-50",    icon: "text-red-700",    badge: "bg-red-50 text-red-800 border-red-300",        text: "text-red-800",    border: "border-red-200"   },
  low_stock:       { bg: "bg-amber-50",  icon: "text-amber-700",  badge: "bg-amber-50 text-amber-800 border-amber-300",  text: "text-amber-800",  border: "border-amber-200" },
  out_of_stock:    { bg: "bg-red-50",    icon: "text-red-700",    badge: "bg-red-50 text-red-800 border-red-300",        text: "text-red-800",    border: "border-red-200"   },
  uc_not_sent:     { bg: "bg-amber-50",  icon: "text-amber-700",  badge: "bg-amber-50 text-amber-800 border-amber-300",  text: "text-amber-800",  border: "border-amber-200" },
  ceat_overdue:    { bg: "bg-red-50",    icon: "text-red-700",    badge: "bg-red-50 text-red-800 border-red-300",        text: "text-red-800",    border: "border-red-200"   },
};

interface Props {
  position?: "sidebar" | "mobile" | "mobile-header";
}

export function NotificationBell({ position = "sidebar" }: Props) {
  const { notifications, totalCount, hasNew, loading, markAsSeen, refreshAlerts } =
    useNotifications();
  const [open, setOpen]             = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const panelRef                    = useRef<HTMLDivElement>(null);

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

  const panelClass =
    position === "mobile" || position === "mobile-header"
      ? "fixed top-16 left-2 right-2 z-50 rounded-2xl bg-white shadow-2xl overflow-hidden"
      : "absolute left-0 top-11 z-50 w-80 rounded-2xl bg-white shadow-2xl overflow-hidden";

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        title="Notifications"
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
          open
            ? "border-white/30 bg-white/20"
            : "border-white/15 bg-white/10 hover:bg-white/20"
        )}
      >
        <Bell className="h-4 w-4 text-white/80" />

        {/* Red dot */}
        {hasNew && (
          <>
            <span className="absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-[#2D2B55]">
              {totalCount > 9 ? "9+" : totalCount}
            </span>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-400 animate-ping opacity-50" />
          </>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className={panelClass} style={{ border: "0.5px solid #e5e7eb" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">Alerts</span>
              {totalCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {totalCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-gray-400", refreshing && "animate-spin")} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[420px] overflow-y-auto">

            {loading && (
              <div className="flex justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center py-10 px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-50 mb-3">
                  <Bell className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-900">All clear</p>
                <p className="text-xs text-gray-400 mt-1">No active alerts right now</p>
                <button
                  onClick={handleRefresh}
                  className="mt-4 flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Check now
                </button>
              </div>
            )}

            {!loading && notifications.map((alert, i) => {
              const colors  = ALERT_COLORS[alert.type] ?? ALERT_COLORS.low_stock;
              const Icon    = ALERT_ICON_MAP[alert.type] ?? AlertTriangle;
              const link    = ALERT_LINKS[alert.type];
              const linkLbl = ALERT_LINK_LABELS[alert.type] ?? "View";
              const isLast  = i === notifications.length - 1;

              return (
                <div key={alert.type}
                  className={cn("flex gap-3 px-4 py-3.5", !isLast && "border-b border-gray-50")}>
                  {/* Icon badge */}
                  <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5", colors.bg)}>
                    <Icon className={cn("h-4 w-4", colors.icon)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-tight">
                      {alert.message}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {alert.items.map((item, j) => (
                        <li key={j} className="text-xs text-gray-500 leading-snug truncate">
                          {item}
                        </li>
                      ))}
                    </ul>
                    {link && (
                      <Link
                        href={link}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "inline-flex items-center gap-1 mt-2 text-xs font-medium px-2 py-1 rounded-md border transition-colors",
                          colors.badge
                        )}
                      >
                        {linkLbl}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mx-auto"
              >
                <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                {refreshing ? "Checking..." : "Check for new alerts"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}