"use client";

import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Package, FileText, CalendarClock, RotateCcw, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useStock } from "@/hooks/useStock";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatLKR } from "@/lib/utils";
import type { Invoice, Cheque } from "@/types";

const quickLinks = [
  { href: "/dashboard/invoices/new", label: "New Invoice",    icon: FileText,      color: "bg-brand-50 text-brand-600"  },
  { href: "/dashboard/inventory",    label: "View Inventory", icon: Package,       color: "bg-green-50 text-green-600"  },
  { href: "/dashboard/cheques",      label: "Cheques Due",    icon: CalendarClock, color: "bg-amber-50 text-amber-600"  },
  { href: "/dashboard/uc-returns",   label: "UC Returns",     icon: RotateCcw,     color: "bg-red-50 text-red-600"      },
];

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { lowStockItems } = useStock();
  const [todaySales, setTodaySales]       = useState(0);
  const [dueCheques, setDueCheques]       = useState(0);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        // Today's invoices
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
        setTodaySales(invoices.reduce((sum, inv) => sum + inv.totalAmount, 0));
        setRecentInvoices(invoices.slice(0, 5));

        // Cheques due within 3 days
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
      } catch (e) {
        // silently handle — Firestore index may not exist yet
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">
          {greeting}, {appUser?.displayName?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Dilshan Enterprises — Tire Distributors · Anuradhapura District
        </p>
      </div>

      {/* Alert banners */}
      {dueCheques > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800">
            <span className="font-medium">{dueCheques} cheque{dueCheques > 1 ? "s" : ""}</span> due within 3 days —{" "}
            <Link href="/dashboard/cheques" className="underline underline-offset-2">view now</Link>
          </p>
        </div>
      )}
      {lowStockItems.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <Package className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-medium">{lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""}</span> low on stock —{" "}
            <Link href="/dashboard/inventory" className="underline underline-offset-2">check inventory</Link>
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5">
            <TrendingUp className="h-5 w-5 text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Today's sales</p>
            <p className="text-lg font-medium text-gray-900">
              {loading ? "—" : formatLKR(todaySales)}
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
              {loading ? "—" : dueCheques}
            </p>
          </div>
        </Card>
      </div>

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

      {/* Recent invoices */}
      {recentInvoices.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Today's invoices</h2>
            <Link href="/dashboard/invoices" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          <Card padding={false}>
            {recentInvoices.map((inv, i) => (
              <div key={inv.id} className={`flex items-center justify-between px-4 py-3 ${i < recentInvoices.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.shopName}</p>
                  <p className="text-xs text-gray-400">{inv.invoiceNo} · {inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days")}</p>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatLKR(inv.totalAmount)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
