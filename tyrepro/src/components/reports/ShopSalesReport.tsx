"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShops } from "@/hooks/useShops";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate } from "@/lib/utils";
import { TrendingUp, AlertCircle, FileSpreadsheet, Download } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import type { Invoice } from "@/types";

interface ShopStat {
  shopId: string; shopName: string;
  total: number; invoices: number;
  cash: number; cheque: number; outstanding: number;
}

export default function ShopSalesReport() {
  const { shops } = useShops(false);
  const { appUser } = useAuth();
  const [range, setRange] = useState("month");
  const [stats, setStats] = useState<ShopStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      const now = new Date(); let start = new Date(now);
      if (range === "week") start.setDate(now.getDate() - 6);
      if (range === "month") start.setDate(1);
      if (range === "all") start = new Date(2020, 0, 1);
      start.setHours(0, 0, 0, 0);
      try {
        const snap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(start)),
          orderBy("invoiceDate", "desc")
        ));
        const invs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
        const map: Record<string, ShopStat> = {};
        invs.forEach(inv => {
          if (!map[inv.shopId]) {
            const shop = shops.find(s => s.id === inv.shopId);
            map[inv.shopId] = { shopId: inv.shopId, shopName: inv.shopName, total: 0, invoices: 0, cash: 0, cheque: 0, outstanding: shop?.outstandingBalance ?? 0 };
          }
          map[inv.shopId].total += inv.totalAmount;
          map[inv.shopId].invoices += 1;
          if (inv.paymentType === "cash") map[inv.shopId].cash += inv.totalAmount;
          else map[inv.shopId].cheque += inv.totalAmount;
        });
        setStats(Object.values(map).sort((a, b) => b.total - a.total));
      } catch { }
      setLoading(false);
    }
    if (shops.length > 0 || range) load();
  }, [range, shops.length]);

  const rangeLabel = range === "week" ? "Last 7 days" : range === "month" ? "This month" : "All time";
  const filtered = stats.filter(s => s.shopName.toLowerCase().includes(search.toLowerCase()));
  const grandTotal = filtered.reduce((s, st) => s + st.total, 0);

  function handleExcelExport() {
    exportToExcel(
      filtered.map((s, i) => ({
        "Rank": i + 1,
        "Shop": s.shopName,
        "Total Sales (Rs)": s.total,
        "Invoices": s.invoices,
        "Cash (Rs)": s.cash,
        "Cheque (Rs)": s.cheque,
        "Outstanding (Rs)": s.outstanding,
      })),
      `Shop-Sales-${rangeLabel.replace(/\s/g, "-")}`,
      "Shop Sales"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      "Shop-wise Sales Report",
      rangeLabel,
      ["Rank", "Shop", "Total Sales", "Invoices", "Cash", "Cheque", "Outstanding"],
      filtered.map((s, i) => [
        i + 1, s.shopName,
        `Rs ${s.total.toLocaleString()}`, s.invoices,
        `Rs ${s.cash.toLocaleString()}`,
        `Rs ${s.cheque.toLocaleString()}`,
        s.outstanding > 0 ? `Rs ${s.outstanding.toLocaleString()}` : "—",
      ]),
      [
        { label: "Grand Total", value: formatLKR(grandTotal) },
        { label: "Shops", value: String(filtered.length) },
      ]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base font-medium text-gray-800">Shop-wise sales</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && !loading && filtered.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={handleExcelExport} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={handlePDFExport} className="gap-1.5">
                <Download className="h-4 w-4 text-red-500" /> PDF
              </Button>
            </>
          )}
          <Dropdown value={range} onChange={setRange} className="w-full sm:w-40"
            options={[
              { value: "week", label: "Last 7 days" },
              { value: "month", label: "This month" },
              { value: "all", label: "All time" },
            ]}
          />
        </div>
      </div>

      <Input placeholder="Search shop..." value={search} onChange={e => setSearch(e.target.value)} />

      <Card className="flex items-center justify-between bg-brand-600 border-0 text-white gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-xs text-brand-200 truncate">Total sales — {filtered.length} shops</p>
          <p className="text-xl md:text-2xl font-semibold truncate">{formatLKR(grandTotal)}</p>
        </div>
        <TrendingUp className="h-8 w-8 text-brand-300 flex-shrink-0" />
      </Card>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}
      {!loading && filtered.length === 0 && <Card className="py-10 text-center text-sm text-gray-400">No sales data found</Card>}

      {!loading && filtered.map((stat, i) => (
        <Card key={stat.shopId} padding={false}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{stat.shopName}</p>
                  <p className="text-xs text-gray-400">{stat.invoices} invoices</p>
                </div>
              </div>
              <p className="text-base font-semibold text-gray-900 flex-shrink-0">{formatLKR(stat.total)}</p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className="truncate">Cash: <span className="font-medium text-gray-700">{formatLKR(stat.cash)}</span></span>
              <span className="truncate">Cheque: <span className="font-medium text-gray-700">{formatLKR(stat.cheque)}</span></span>
              {stat.outstanding > 0 && (
                <span className="flex items-center gap-1 text-red-600 truncate">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  Outstanding: <span className="font-medium">{formatLKR(stat.outstanding)}</span>
                </span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}