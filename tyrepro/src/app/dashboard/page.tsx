"use client";

import { useAuth } from "@/hooks/useAuth";
import { useNotifications, ALERT_ICONS, ALERT_COLORS } from "@/hooks/useNotifications";
import { Card } from "@/components/ui/Card";
import {
  Package, FileText, CalendarClock, RotateCcw,
  TrendingUp, ChevronDown, ChevronUp, Truck, Store,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatLKR } from "@/lib/utils";
import type { Invoice } from "@/types";
import { cn } from "@/lib/utils";

const ALL_QUICK_LINKS = [
  { href: "/dashboard/invoices/new", label: "New Invoice",    icon: FileText,      bg: "bg-brand-50",   fg: "text-brand-600",   roles: ["admin","sales_rep"]          },
  { href: "/dashboard/inventory",    label: "View Inventory", icon: Package,       bg: "bg-success-50", fg: "text-success-500", roles: ["admin","sales_rep"]          },
  { href: "/dashboard/cheques",      label: "Cheques Due",    icon: CalendarClock, bg: "bg-warning-50", fg: "text-warning-500", roles: ["admin","sales_rep"]          },
  { href: "/dashboard/uc-returns",   label: "UC Returns",     icon: RotateCcw,     bg: "bg-danger-50",  fg: "text-danger-500",  roles: ["admin","sales_rep"]          },
  { href: "/dashboard/dispatch",     label: "Dispatch",       icon: Truck,         bg: "bg-blue-50",    fg: "text-blue-600",    roles: ["admin","sales_rep","driver"] },
];

const ALERT_LINKS: Record<string, string> = {
  cheque_due_soon: "/dashboard/cheques",
  cheque_overdue:  "/dashboard/cheques",
  low_stock:       "/dashboard/inventory",
  out_of_stock:    "/dashboard/inventory",
  uc_not_sent:     "/dashboard/uc-returns",
  ceat_overdue:    "/dashboard/uc-returns",
};

// ── Alert banner ──────────────────────────────────────────

function DashboardAlerts() {
  const { notifications, loading, refreshAlerts } = useNotifications();
  const [expanded, setExpanded]   = useState<string | null>(null);
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
        const icon       = ALERT_ICONS[alert.type] ?? "🔔";
        const link       = ALERT_LINKS[alert.type];
        const isExpanded = expanded === alert.type;

        return (
          <div key={alert.type} className={cn("rounded-xl border px-4 py-3", colorClass)}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <span className="text-base">{icon}</span>
                <p className="text-sm font-medium">{alert.count} × {alert.message}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {link && <Link href={link} className="text-xs underline underline-offset-2 font-medium">View</Link>}
                <button onClick={() => setExpanded(isExpanded ? null : alert.type)}>
                  {isExpanded ? <ChevronUp className="h-4 w-4 opacity-60" /> : <ChevronDown className="h-4 w-4 opacity-60" />}
                </button>
              </div>
            </div>
            {isExpanded && (
              <ul className="mt-2 ml-7 space-y-0.5">
                {alert.items.map((item, i) => <li key={i} className="text-xs opacity-80">• {item}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────

function StatCard({ icon: Icon, bg, fg, label, value, change }: {
  icon: React.ElementType; bg: string; fg: string; label: string; value: string; change?: string;
}) {
  return (
    <Card>
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center mb-3", bg)}>
        <Icon className={cn("h-[18px] w-[18px]", fg)} />
      </div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-xl font-medium text-gray-900">{value}</p>
      {change && <p className="text-[10px] text-gray-400 mt-1">{change}</p>}
    </Card>
  );
}

// ── Main dashboard ────────────────────────────────────────

export default function DashboardPage() {
  const { appUser } = useAuth();
  const role        = appUser?.role ?? "sales_rep";
  const isDriver    = String(role) === "driver";
  const quickLinks  = ALL_QUICK_LINKS.filter(l => l.roles.includes(role));

  const [todaySales, setTodaySales]         = useState(0);
  const [dueCheques, setDueCheques]         = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [statsLoading, setStatsLoading]     = useState(true);

  useEffect(() => {
    if (isDriver) { setStatsLoading(false); return; }
    async function loadStats() {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const invSnap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(startOfDay)),
          orderBy("invoiceDate", "desc")
        ));
        const invoices = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        setTodaySales(invoices.reduce((s, i) => s + i.totalAmount, 0));
        setRecentInvoices(invoices.slice(0, 5));

        const in3days = new Date();
        in3days.setDate(in3days.getDate() + 3);
        const cheqSnap = await getDocs(query(
          collection(db, "cheques"),
          where("status", "==", "pending"),
          where("dueDate", "<=", Timestamp.fromDate(in3days))
        ));
        setDueCheques(cheqSnap.size);
      } catch {}
      finally { setStatsLoading(false); }
    }
    loadStats();
  }, [isDriver]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium text-gray-900">
            {greeting}, {appUser?.displayName?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Dilshan Enterprises · Anuradhapura District
          </p>
        </div>
      </div>

      {!isDriver && <DashboardAlerts />}

      {/* Stat cards */}
      {!isDriver && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={TrendingUp}   bg="bg-brand-50"   fg="text-brand-600"   label="Today's sales"   value={statsLoading ? "—" : formatLKR(todaySales)} />
          <StatCard icon={CalendarClock} bg="bg-warning-50" fg="text-warning-500" label="Cheques due (3d)" value={statsLoading ? "—" : String(dueCheques)} />
          <StatCard icon={Package}       bg="bg-success-50" fg="text-success-500" label="Inventory"        value="View" change="Tap to open" />
          <StatCard icon={RotateCcw}     bg="bg-danger-50"  fg="text-danger-500"  label="UC Returns"       value="View" change="Active returns" />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        {/* Left column */}
        <div>
          {/* Quick actions */}
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Quick actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-6">
            {quickLinks.map(({ href, label, icon: Icon, bg, fg }) => (
              <Link key={href} href={href}>
                <Card className="flex flex-col items-center gap-3 py-5 hover:shadow-sm transition-shadow cursor-pointer text-center">
                  <div className={cn("rounded-xl p-3", bg)}>
                    <Icon className={cn("h-5 w-5", fg)} />
                  </div>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </Card>
              </Link>
            ))}
          </div>

          {/* Recent invoices */}
          {!isDriver && recentInvoices.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Recent invoices</h2>
                <Link href="/dashboard/invoices" className="text-xs text-brand-600 hover:underline">View all →</Link>
              </div>
              <Card padding={false}>
                {recentInvoices.map((inv, i) => (
                  <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
                    <div className={cn(
                      "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer",
                      i < recentInvoices.length - 1 && "border-b border-gray-50"
                    )}>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 flex-shrink-0">
                        <Store className="h-3.5 w-3.5 text-brand-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                        <p className="text-xs text-gray-400">
                          {inv.invoiceNo} · {inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_","Cheque ").replace("d"," days")}
                        </p>
                      </div>
                      <span className="text-sm font-medium text-gray-900 flex-shrink-0">{formatLKR(inv.totalAmount)}</span>
                    </div>
                  </Link>
                ))}
              </Card>
            </>
          )}
        </div>

        {/* Right sidebar — desktop only */}
        {!isDriver && (
          <div className="hidden md:block">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">At a glance</h2>
            <Card className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Cheques due soon</span>
                <span className="font-medium text-gray-900">{dueCheques}</span>
              </div>
              <Link href="/dashboard/cheques" className="block text-xs text-brand-600 hover:underline">
                Manage cheques →
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}