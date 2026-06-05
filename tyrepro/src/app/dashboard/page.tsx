"use client";

import { useAuth } from "@/hooks/useAuth";
import { useStock } from "@/hooks/useStock";
import { useAlerts } from "@/hooks/useAlerts";
import { Card } from "@/components/ui/Card";
import {
  Package, FileText, CalendarClock, RotateCcw,
  TrendingUp, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Truck,
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

const ALL_QUICK_LINKS = [
  { href: "/dashboard/invoices/new", label: "New Invoice",    icon: FileText,      color: "bg-brand-50 text-brand-600", roles: ["admin","sales_rep"]           },
  { href: "/dashboard/inventory",    label: "View Inventory", icon: Package,       color: "bg-green-50 text-green-600", roles: ["admin","sales_rep"]           },
  { href: "/dashboard/cheques",      label: "Cheques Due",    icon: CalendarClock, color: "bg-amber-50 text-amber-600", roles: ["admin","sales_rep"]           },
  { href: "/dashboard/uc-returns",   label: "UC Returns",     icon: RotateCcw,     color: "bg-red-50 text-red-600",    roles: ["admin","sales_rep"]           },
  { href: "/dashboard/dispatch",     label: "Dispatch",       icon: Truck,         color: "bg-blue-50 text-blue-600",  roles: ["admin","sales_rep","driver"]  },
];

const ALERT_LINKS: Record<string, string> = {
  cheque_due_soon: "/dashboard/cheques",
  cheque_overdue:  "/dashboard/cheques",
  low_stock:       "/dashboard/inventory",
  uc_not_sent:     "/dashboard/uc-returns",
  ceat_overdue:    "/dashboard/uc-returns",
};

const ALERT_COLORS: Record<string, string> = {
  cheque_due_soon: "bg-amber-50 border-amber-200 text-amber-800",
  cheque_overdue:  "bg-red-50 border-red-200 text-red-800",
  low_stock:       "bg-amber-50 border-amber-200 text-amber-800",
  uc_not_sent:     "bg-orange-50 border-orange-200 text-orange-800",
  ceat_overdue:    "bg-red-50 border-red-200 text-red-800",
};

function AlertBanner() {
  const { alerts, loading } = useAlerts();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning]   = useState(false);

  async function runNow() {
    setRunning(true);
    await fetch("/api/run-alerts");
    setRunning(false);
  }

  if (loading || alerts.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      {alerts.map(alert => (
        <div key={alert.type} className={`rounded-xl border px-4 py-3 ${ALERT_COLORS[alert.type] ?? "bg-gray-50 border-gray-200 text-gray-800"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                {alert.count} × {alert.message}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link href={ALERT_LINKS[alert.type] ?? "/dashboard"} className="text-xs underline underline-offset-2">
                View
              </Link>
              <button onClick={() => setExpanded(expanded === alert.type ? null : alert.type)}>
                {expanded === alert.type
                  ? <ChevronUp className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {expanded === alert.type && (
            <ul className="mt-2 ml-6 space-y-0.5">
              {alert.items.map((item, i) => (
                <li key={i} className="text-xs opacity-90">• {item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} />
          {running ? "Checking..." : "Refresh alerts"}
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { appUser }    = useAuth();
  const { lowStockItems } = useStock();

  const [todaySales, setTodaySales]         = useState(0);
  const [dueCheques, setDueCheques]         = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [statsLoading, setStatsLoading]     = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const invSnap = await getDocs(
          query(
            collection(db, "invoices"),
            where("status", "==", "confirmed"),
            where("invoiceDate", ">=", Timestamp.fromDate(startOfDay)),
            orderBy("invoiceDate", "desc")
          )
        );
        const invoices = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        setTodaySales(invoices.reduce((s, i) => s + i.totalAmount, 0));
        setRecentInvoices(invoices.slice(0, 5));

        const in3days = new Date();
        in3days.setDate(in3days.getDate() + 3);
        const cheqSnap = await getDocs(
          query(
            collection(db, "cheques"),
            where("status", "==", "pending"),
            where("dueDate", "<=", Timestamp.fromDate(in3days))
          )
        );
        setDueCheques(cheqSnap.size);
      } catch {}
      finally { setStatsLoading(false); }
    }
    loadStats();
  }, []);

  const role       = appUser?.role ?? "sales_rep";
  const quickLinks = ALL_QUICK_LINKS.filter(l => l.roles.includes(role));
  const isDriver   = role === "driver";
  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">
          {greeting}, {appUser?.displayName?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dilshan Enterprises — Tire Distributors · Anuradhapura District
        </p>
      </div>

      {/* Alert banners — admin/sales_rep only */}
      {!isDriver && <AlertBanner />}

      {/* Stats — admin/sales_rep only */}
      {!isDriver && (
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5">
            <TrendingUp className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Today's sales</p>
            <p className="text-lg font-medium text-gray-900">
              {statsLoading ? "—" : formatLKR(todaySales)}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5">
            <CalendarClock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Cheques due (3d)</p>
            <p className="text-lg font-medium text-gray-900">
              {statsLoading ? "—" : dueCheques}
            </p>
          </div>
        </Card>
      </div>
      )} {/* end !isDriver stats */}

      {/* Quick actions */}
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Quick actions</h2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {quickLinks.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}>
            <Card className="flex flex-col items-center gap-3 py-5 hover:shadow-md transition-shadow cursor-pointer text-center">
              <div className={`rounded-xl p-3 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-gray-800">{label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent invoices — admin/sales_rep only */}
      {!isDriver && recentInvoices.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Today's invoices</h2>
            <Link href="/dashboard/invoices" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <Card padding={false}>
            {recentInvoices.map((inv, i) => (
              <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
                <div className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer ${i < recentInvoices.length - 1 ? "border-b border-gray-50" : ""}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{inv.shopName}</p>
                    <p className="text-xs text-gray-400">
                      {inv.invoiceNo} · {inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days")}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{formatLKR(inv.totalAmount)}</span>
                </div>
              </Link>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
