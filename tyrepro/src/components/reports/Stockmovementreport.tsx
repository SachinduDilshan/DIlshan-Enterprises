"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStock } from "@/hooks/useStock";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { formatDate } from "@/lib/utils";
import { Package, ArrowLeftRight, AlertTriangle } from "lucide-react";
import type { StockTransfer } from "@/types";

const WAREHOUSES = [
  { value: "",             label: "All warehouses" },
  { value: "kurunegala",   label: "Kurunegala"     },
  { value: "anuradhapura", label: "Anuradhapura"   },
];

export default function StockMovementReport() {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [whFilter, setWhFilter]   = useState("");
  const { stock, lowStockItems }  = useStock();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "stockTransfers"), orderBy("transferDate", "desc"))
        );
        setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTransfer)));
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filteredStock = whFilter
    ? stock.filter(s => s.warehouseId === whFilter)
    : stock;

  const filteredTransfers = whFilter
    ? transfers.filter(t => t.fromWarehouseId === whFilter || t.toWarehouseId === whFilter)
    : transfers;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-800">Stock movement</h2>
        <Select value={whFilter} onChange={e => setWhFilter(e.target.value)} options={WAREHOUSES} className="w-40" />
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Low stock items ({lowStockItems.length})</p>
          </div>
          <div className="space-y-1.5">
            {lowStockItems.map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-amber-900">{s.productName} — {s.warehouseName}</span>
                <span className="font-semibold text-red-700">{s.qty} left (min {s.reorderLevel})</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Current stock levels */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-50 bg-gray-50 rounded-t-2xl">
          <p className="text-sm font-medium text-gray-700">Current stock levels</p>
        </div>
        {filteredStock.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 ${i < filteredStock.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div>
              <p className="text-sm font-medium text-gray-900">{s.productName}</p>
              <p className="text-xs text-gray-400">{s.warehouseName} · {s.productSku}</p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${s.qty <= s.reorderLevel ? "text-red-600" : "text-gray-900"}`}>
                {s.qty} units
              </p>
              <p className="text-xs text-gray-400">min {s.reorderLevel}</p>
            </div>
          </div>
        ))}
      </Card>

      {/* Transfer history */}
      <h3 className="text-sm font-medium text-gray-600 mt-2">Transfer history</h3>

      {loading && <div className="flex justify-center py-6"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}

      {!loading && filteredTransfers.length === 0 && (
        <Card className="py-8 text-center text-sm text-gray-400">No transfers yet</Card>
      )}

      <Card padding={false}>
        {filteredTransfers.map((t, i) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i < filteredTransfers.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
              <ArrowLeftRight className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t.productName}</p>
              <p className="text-xs text-gray-400">
                {t.fromWarehouseName} → {t.toWarehouseName} · {formatDate(t.transferDate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{t.qty} units</p>
              <Badge variant={t.status === "completed" ? "success" : "default"}>{t.status}</Badge>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}