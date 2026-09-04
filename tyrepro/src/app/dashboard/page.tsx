"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useStock } from "@/hooks/useStock";
import { formatLKR, formatDate } from "@/lib/utils";
import {
  TrendingUp,
  CalendarClock,
  Package,
  RotateCcw,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Truck,
  Bell,
  RefreshCw,
  AlertTriangle,
  PackageX,
  Send,
  Clock3,
  CircleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types";

const ALERT_LINKS: Record<string, string> = {
  cheque_due_soon: "/dashboard/cheques",
  cheque_overdue: "/dashboard/cheques",
  low_stock: "/dashboard/inventory",
  out_of_stock: "/dashboard/inventory",
  uc_not_sent: "/dashboard/uc-returns",
  ceat_overdue: "/dashboard/uc-returns",
};

const ALL_QUICK_LINKS = [
  { href: "/dashboard/invoices/new", label: "New invoice", icon: Plus, roles: ["admin", "sales_rep"] },
  { href: "/dashboard/inventory", label: "View inventory", icon: Package, roles: ["admin", "sales_rep"] },
  { href: "/dashboard/cheques", label: "Cheques due", icon: CalendarClock, roles: ["admin", "sales_rep"] },
  { href: "/dashboard/uc-returns", label: "UC returns", icon: RotateCcw, roles: ["admin", "sales_rep"] },
  { href: "/dashboard/reports", label: "Sales Report", icon: BarChart3, roles: ["admin", "sales_rep"] },
  { href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, roles: ["admin", "sales_rep", "driver"] },
];

function AlertBanner() {
  const { notifications, loading, refreshAlerts } = useNotifications();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);

    try {
      await refreshAlerts();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading || notifications.length === 0) {
    return null;
  }

  const getAlertStyle = (type: string) => {
    switch (type) {
      case "low_stock":
        return {
          icon: Package,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
          badgeBg: "bg-amber-50",
          badgeColor: "text-amber-700",
          label: "Inventory",
        };

      case "out_of_stock":
        return {
          icon: PackageX,
          iconBg: "bg-red-50",
          iconColor: "text-red-600",
          badgeBg: "bg-red-50",
          badgeColor: "text-red-700",
          label: "Stock",
        };

      case "uc_not_sent":
        return {
          icon: Send,
          iconBg: "bg-blue-50",
          iconColor: "text-blue-600",
          badgeBg: "bg-blue-50",
          badgeColor: "text-blue-700",
          label: "CEAT UC",
        };

      case "ceat_overdue":
        return {
          icon: Clock3,
          iconBg: "bg-red-50",
          iconColor: "text-red-600",
          badgeBg: "bg-red-50",
          badgeColor: "text-red-700",
          label: "CEAT UC",
        };

      case "cheque_due_soon":
        return {
          icon: CalendarClock,
          iconBg: "bg-amber-50",
          iconColor: "text-amber-600",
          badgeBg: "bg-amber-50",
          badgeColor: "text-amber-700",
          label: "Cheques",
        };

      case "cheque_overdue":
        return {
          icon: CircleAlert,
          iconBg: "bg-red-50",
          iconColor: "text-red-600",
          badgeBg: "bg-red-50",
          badgeColor: "text-red-700",
          label: "Cheques",
        };

      default:
        return {
          icon: AlertTriangle,
          iconBg: "bg-gray-100",
          iconColor: "text-gray-600",
          badgeBg: "bg-gray-100",
          badgeColor: "text-gray-700",
          label: "Attention",
        };
    }
  };

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

      {/* Header */}

      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">

        <div className="flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#383364]/10">
            <Bell className="h-4 w-4 text-[#383364]" />
          </div>

          <div>
            <div className="flex items-center gap-2">

              <p className="text-sm font-semibold text-gray-900">
                Needs attention
              </p>

              <span className="rounded-full bg-[#383364]/10 px-2 py-0.5 text-[11px] font-semibold text-[#383364]">
                {notifications.length}
              </span>

            </div>

            <p className="mt-0.5 text-xs text-gray-400">
              Items that may require your attention
            </p>

          </div>

        </div>


        {/* Refresh */}

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh notifications"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4",
              refreshing && "animate-spin"
            )}
          />
        </button>

      </div>


      {/* Notification list */}

      <div>

        {notifications.map((alert, index) => {

          const style = getAlertStyle(alert.type);

          const Icon = style.icon;

          const link = ALERT_LINKS[alert.type];

          const isExpanded = expanded === alert.type;

          return (
            <div
              key={alert.type}
              className={cn(
                "transition-colors hover:bg-gray-50/70",
                index < notifications.length - 1 &&
                "border-b border-gray-100"
              )}
            >

              {/* Main notification row */}

              <div className="flex items-center gap-3 px-4 py-3.5">

                {/* Icon */}

                <div
                  className={cn(
                    "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                    style.iconBg
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      style.iconColor
                    )}
                  />
                </div>


                {/* Content */}

                <div className="min-w-0 flex-1">

                  <div className="flex items-center gap-2">

                    <p className="truncate text-sm font-medium text-gray-900">
                      {alert.message}
                    </p>

                    <span
                      className={cn(
                        "hidden rounded-full px-2 py-0.5 text-[10px] font-medium sm:inline-flex",
                        style.badgeBg,
                        style.badgeColor
                      )}
                    >
                      {style.label}
                    </span>

                  </div>

                  <p className="mt-0.5 text-xs text-gray-400">
                    {alert.count} item{alert.count !== 1 ? "s" : ""} require
                    {alert.count === 1 ? "s" : ""} attention
                  </p>

                </div>


                {/* Count */}

                <div className="hidden flex-shrink-0 sm:block">

                  <span
                    className={cn(
                      "flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold",
                      style.badgeBg,
                      style.badgeColor
                    )}
                  >
                    {alert.count}
                  </span>

                </div>


                {/* View */}

                {link && (
                  <Link
                    href={link}
                    className="hidden flex-shrink-0 text-xs font-medium text-[#383364] hover:underline sm:block"
                  >
                    View
                  </Link>
                )}


                {/* Expand */}

                {alert.items?.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded(
                        isExpanded ? null : alert.type
                      )
                    }
                    aria-label={
                      isExpanded
                        ? "Collapse notification"
                        : "Expand notification"
                    }
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}

              </div>


              {/* Expanded details */}

              {isExpanded && alert.items?.length > 0 && (

                <div className="px-4 pb-4 pl-16">

                  <div className="rounded-lg bg-gray-50 px-4 py-3">

                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Details
                    </p>

                    <ul className="space-y-1.5">

                      {alert.items.map((item, i) => (

                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-gray-600"
                        >

                          <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-gray-400" />

                          <span>
                            {item}
                          </span>

                        </li>

                      ))}

                    </ul>

                  </div>

                </div>

              )}

            </div>
          );
        })}

      </div>

    </div>
  );
}

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { stock } = useStock();
  const role = appUser?.role ?? "sales_rep";
  const isDriver = role === ("driver" as string);
  const quickLinks = ALL_QUICK_LINKS.filter(l => l.roles.includes(role));

  const [todaySales, setTodaySales] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [dueCheques, setDueCheques] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [activeUC, setActiveUC] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (isDriver) { setStatsLoading(false); return; }
    async function loadStats() {
      try {
        const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
        const invSnap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(startOfDay)),
          orderBy("invoiceDate", "desc")
        ));
        const invoices = invSnap.docs.map(d => ({ ...d.data(), id: d.id } as Invoice));
        setTodaySales(invoices.reduce((s, i) => s + i.totalAmount, 0));
        setInvoiceCount(invoices.length);
        setRecentInvoices(invoices.slice(0, 5));

        const in3days = new Date(); in3days.setDate(in3days.getDate() + 3);
        const cheqSnap = await getDocs(query(
          collection(db, "cheques"),
          where("status", "==", "pending"),
          where("dueDate", "<=", Timestamp.fromDate(in3days))
        ));
        setDueCheques(cheqSnap.size);

        const ucSnap = await getDocs(query(
          collection(db, "ucReturns"),
          where("status", "!=", "closed")
        ));
        setActiveUC(ucSnap.size);
      } catch { }
      finally { setStatsLoading(false); }
    }
    loadStats();
  }, [isDriver]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-LK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const totalStock = stock.reduce((s, item) => s + item.qty, 0);

  const METRICS = [
    {
      label: "Today's sales",
      value: statsLoading ? "—" : formatLKR(todaySales),
      sub: statsLoading ? "" : `${invoiceCount} invoice${invoiceCount !== 1 ? "s" : ""} today`,
      icon: TrendingUp,
      bg: "bg-brand-50",
      fg: "text-brand-700",
    },
    {
      label: "Cheques due (3d)",
      value: statsLoading ? "—" : String(dueCheques),
      sub: dueCheques === 0 ? "No action needed" : `${dueCheques} cheque${dueCheques > 1 ? "s" : ""} need attention`,
      icon: CalendarClock,
      bg: "bg-amber-50",
      fg: "text-amber-700",
    },
    {
      label: "Total stock",
      value: String(totalStock),
      sub: `${stock.length} SKU${stock.length !== 1 ? "s" : ""}`,
      icon: Package,
      bg: "bg-green-50",
      fg: "text-green-700",
    },
    {
      label: "Active UC returns",
      value: statsLoading ? "—" : String(activeUC),
      sub: activeUC === 0 ? "Nothing pending" : `${activeUC} open return${activeUC > 1 ? "s" : ""}`,
      icon: RotateCcw,
      bg: "bg-red-50",
      fg: "text-red-700",
    },
  ];

  return (
    <div className="p-5 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-gray-900">
            {greeting}, {appUser?.displayName?.split(" ").slice(-1)[0] ?? "there"}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        {!isDriver && (
          <Link href="/dashboard/invoices/new">
            <button className="flex items-center gap-1.5 bg-brand-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-800 transition-colors">
              <Plus className="h-4 w-4" /> New invoice
            </button>
          </Link>
        )}
      </div>

      {!isDriver && <AlertBanner />}

      {/* Metric cards */}
      {!isDriver && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {METRICS.map(m => (
            <div key={m.label}
              className="bg-white border border-gray-100 rounded-xl p-4">
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center mb-3", m.bg)}>
                <m.icon className={cn("h-3.5 w-3.5", m.fg)} />
              </div>
              <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
              <p className="text-xl font-medium text-gray-900 truncate">{m.value}</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{m.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className={cn(
        "gap-4",
        !isDriver ? "grid md:grid-cols-[1fr_220px]" : "block"
      )}>
        {/* Recent invoices */}
        {!isDriver && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-medium text-gray-900">Recent invoices</p>
              <Link href="/dashboard/invoices"
                className="text-xs text-brand-700 hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {recentInvoices.length === 0 && !statsLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No invoices today
              </div>
            )}

            {recentInvoices.map((inv, i) => {
              const isCash = inv.paymentType === "cash";
              return (
                <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer",
                    i < recentInvoices.length - 1 && "border-b border-gray-50"
                  )}>
                    <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0",
                      isCash ? "bg-green-500" : "bg-blue-500"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                      <p className="text-xs text-gray-400">
                        {inv.invoiceNo} · {isCash ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days")} · {formatDate(inv.invoiceDate)}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0",
                      isCash ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"
                    )}>
                      {isCash ? "Cash" : "Cheque"}
                    </span>
                    <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                      {formatLKR(inv.totalAmount)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick actions */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-medium text-gray-900">Quick actions</p>
          </div>
          <div className="p-2">
            {quickLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group">
                  <Icon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">{label}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}