"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, ALERT_ICONS, ALERT_COLORS } from "@/hooks/useNotifications";
import { useStock } from "@/hooks/useStock";
import { formatLKR, formatDate } from "@/lib/utils";
import {
  TrendingUp, CalendarClock, Package, RotateCcw,
  Plus, ChevronRight, ChevronDown, ChevronUp, BarChart3, Truck,
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
    await refreshAlerts();
    setRefreshing(false);
  }

  if (loading || notifications.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {notifications.map(alert => {
        const colorClass = ALERT_COLORS[alert.type] ?? "text-gray-700 bg-gray-50 border-gray-200";
        const icon = ALERT_ICONS[alert.type] ?? "🔔";
        const link = ALERT_LINKS[alert.type];
        const isExpanded = expanded === alert.type;

        return (
          <div key={alert.type}
            className={cn("rounded-lg border px-4 py-2.5 flex items-center gap-2", colorClass)}>
            <span className="text-sm">{icon}</span>
            <p className="text-sm font-medium flex-1">
              {alert.count} × {alert.message}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              {link && (
                <Link href={link} className="text-xs font-medium underline underline-offset-2">
                  View
                </Link>
              )}
              <button onClick={() => setExpanded(isExpanded ? null : alert.type)}>
                {isExpanded
                  ? <ChevronUp className="h-3.5 w-3.5 opacity-60" />
                  : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
              </button>
            </div>
            {isExpanded && (
              <ul className="w-full mt-1.5 ml-6 space-y-0.5 col-span-full">
                {alert.items.map((item, i) => (
                  <li key={i} className="text-xs opacity-80">• {item}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { stock } = useStock();
  const role = appUser?.role ?? "sales_rep";
  const isDriver = role === "driver";
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
            <button className="flex items-center gap-1.5 bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-800 transition-colors">
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
                className="text-xs text-brand-600 hover:underline flex items-center gap-0.5">
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