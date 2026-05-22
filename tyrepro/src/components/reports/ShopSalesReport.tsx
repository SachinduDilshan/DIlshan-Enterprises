"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShops } from "@/hooks/useShops";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { formatLKR, formatDate } from "@/lib/utils";
import { Store, TrendingUp, AlertCircle } from "lucide-react";
import type { Invoice } from "@/types";

interface ShopStat {
  shopId:   string;
  shopName: string;
  total:    number;
  invoices: number;
  cash:     number;
  cheque:   number;
  outstanding: number;
}

export default function ShopSalesReport() {
  const { shops } = useShops(false);
  const [range, setRange]       = useState("month");
  const [stats, setStats]       = useState<ShopStat[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const now   = new Date();
      let start   = new Date(now);

      if (range === "week")  { start.setDate(now.getDate() - 6); }
      if (range === "month") { start.setDate(1); }
      if (range === "all")   { start = new Date(2020, 0, 1); }
      start.setHours(0, 0, 0, 0);

      try {
        const snap = await getDocs(
          query(
            collection(db, "invoices"),
            where("status", "==", "confirmed"),
            where("invoiceDate", ">=", Timestamp.fromDate(start)),
            orderBy("invoiceDate", "desc")
          )
        );
        const invs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));

        // Aggregate per shop
        const map: Record<string, ShopStat> = {};
        invs.forEach(inv => {
          if (!map[inv.shopId]) {
            const shop = shops.find(s => s.id === inv.shopId);
            map[inv.shopId] = {
              shopId:      inv.shopId,
              shopName:    inv.shopName,
              total:       0, invoices: 0,
              cash:        0, cheque:   0,
              outstanding: shop?.outstandingBalance ?? 0,
            };
          }
          map[inv.shopId].total    += inv.totalAmount;
          map[inv.shopId].invoices += 1;
          if (inv.paymentType === "cash") map[inv.shopId].cash   += inv.totalAmount;
          else                            map[inv.shopId].cheque += inv.totalAmount;
        });

        // Sort by total desc
        setStats(Object.values(map).sort((a, b) => b.total - a.total));
      } catch {}
      setLoading(false);
    }
    if (shops.length > 0 || range) load();
  }, [range, shops.length]);

  const filtered = stats.filter(s =>
    s.shopName.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = filtered.reduce((s, st) => s + st.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-gray-800">Shop-wise sales</h2>
        <Select
          value={range}
          onChange={e => setRange(e.target.value)}
          options={[
            { value: "week",  label: "Last 7 days" },
            { value: "month", label: "This month"  },
            { value: "all",   label: "All time"    },
          ]}
          className="w-36"
        />
      </div>

      <Input placeholder="Search shop..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Grand total */}
      <Card className="flex items-center justify-between bg-brand-600 border-0 text-white">
        <div>
          <p className="text-xs text-brand-200">Total sales — {filtered.length} shops</p>
          <p className="text-2xl font-semibold">{formatLKR(grandTotal)}</p>
        </div>
        <TrendingUp className="h-8 w-8 text-brand-300" />
      </Card>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}

      {!loading && filtered.length === 0 && (
        <Card className="py-10 text-center text-sm text-gray-400">No sales data found</Card>
      )}

      {!loading && filtered.map((stat, i) => (
        <Card key={stat.shopId} padding={false}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 w-5">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{stat.shopName}</p>
                  <p className="text-xs text-gray-400">{stat.invoices} invoices</p>
                </div>
              </div>
              <p className="text-base font-semibold text-gray-900">{formatLKR(stat.total)}</p>
            </div>

            {/* Bar */}
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-brand-500"
                style={{ width: `${grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0}%` }}
              />
            </div>

            {/* Cash vs cheque */}
            <div className="mt-2 flex gap-4 text-xs text-gray-500">
              <span>Cash: <span className="font-medium text-gray-700">{formatLKR(stat.cash)}</span></span>
              <span>Cheque: <span className="font-medium text-gray-700">{formatLKR(stat.cheque)}</span></span>
              {stat.outstanding > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-3 w-3" />
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
