"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useStock } from "@/hooks/useStock";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { ArrowLeftRight, AlertTriangle, FileSpreadsheet, Download } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import type { StockTransfer } from "@/types";

const WAREHOUSES = [
  { value: "", label: "All warehouses" },
  { value: "polonnaruwa", label: "Polonnaruwa" },
  { value: "anuradhapura", label: "Anuradhapura" },
];

export default function StockMovementReport() {
  const { appUser } = useAuth();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [whFilter, setWhFilter] = useState("");
  const { stock, lowStockItems } = useStock();
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "stockTransfers"), orderBy("transferDate", "desc")));
        setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() } as StockTransfer)));
      } catch { }
      setLoading(false);
    }
    load();
  }, []);

  const filteredStock = whFilter ? stock.filter(s => s.warehouseId === whFilter) : stock;
  const filteredTransfers = whFilter ? transfers.filter(t => t.fromWarehouseId === whFilter || t.toWarehouseId === whFilter) : transfers;

  function handleStockExcel() {
    exportToExcel(
      filteredStock.map(s => ({
        "Product": s.productName,
        "SKU": s.productSku,
        "Warehouse": s.warehouseName,
        "Type": s.productType === "bike" ? "Bike" : "Three-Wheeler",
        "Qty": s.qty,
        "Reorder Level": s.reorderLevel,
        "Status": s.qty <= 0 ? "Out of stock" : s.qty <= s.reorderLevel ? "Low" : "OK",
      })),
      `Stock-Levels-${whFilter || "All"}`,
      "Stock Levels"
    );
  }

  function handleTransferExcel() {
    exportToExcel(
      filteredTransfers.map(t => ({
        "Product": t.productName,
        "SKU": t.productSku,
        "From": t.fromWarehouseName,
        "To": t.toWarehouseName,
        "Qty": t.qty,
        "Status": t.status,
        "Date": formatDate(t.transferDate),
      })),
      `Stock-Transfers-${whFilter || "All"}`,
      "Transfers"
    );
  }

  function handleStockPDF() {
    exportToPDF(
      "Stock Level Report",
      whFilter ? WAREHOUSES.find(w => w.value === whFilter)?.label ?? "" : "All warehouses",
      ["Product", "SKU", "Warehouse", "Type", "Qty", "Reorder Level", "Status"],
      filteredStock.map(s => [
        s.productName, s.productSku, s.warehouseName,
        s.productType === "bike" ? "Bike" : "3W",
        s.qty, s.reorderLevel,
        s.qty <= 0 ? "Out of stock" : s.qty <= s.reorderLevel ? "Low" : "OK",
      ]),
      [
        { label: "Total SKUs", value: String(filteredStock.length) },
        { label: "Low stock items", value: String(lowStockItems.length) },
        { label: "Total units", value: String(filteredStock.reduce((s, i) => s + i.qty, 0)) },
      ]
    );
  }

  function handleTransferPDF() {
    exportToPDF(
      "Stock Transfer Report",
      whFilter ? WAREHOUSES.find(w => w.value === whFilter)?.label ?? "" : "All warehouses",
      ["Product", "From", "To", "Qty", "Status", "Date"],
      filteredTransfers.map(t => [
        t.productName, t.fromWarehouseName, t.toWarehouseName,
        t.qty, t.status, formatDate(t.transferDate),
      ])
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
        <h3 className="text-sm font-medium text-gray-600">Transfer history</h3>
        {isAdmin && !loading && filteredTransfers.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleTransferExcel} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
            </Button>
            <Button size="sm" variant="secondary" onClick={handleTransferPDF} className="gap-1.5">
              <Download className="h-4 w-4 text-red-500" /> PDF
            </Button>
          </div>
        )}
      </div>

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

      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-50 bg-gray-50 rounded-t-2xl">
          <p className="text-sm font-medium text-gray-700">Current stock levels</p>
        </div>
        {filteredStock.map((s, i) => (
          <div key={s.id} className={`flex items-center justify-between gap-2 px-4 py-2.5 ${i < filteredStock.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{s.productName}</p>
              <p className="text-xs text-gray-400 truncate">{s.warehouseName} · {s.productSku}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-semibold ${s.qty <= s.reorderLevel ? "text-red-600" : "text-gray-900"}`}>{s.qty} units</p>
              <p className="text-xs text-gray-400">min {s.reorderLevel}</p>
            </div>
          </div>
        ))}
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base font-medium text-gray-800">Stock movement</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && !loading && (
            <>
              <Button size="sm" variant="secondary" onClick={handleStockExcel} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Stock Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={handleStockPDF} className="gap-1.5">
                <Download className="h-4 w-4 text-red-500" /> Stock PDF
              </Button>
            </>
          )}
          <Select value={whFilter} onChange={e => setWhFilter(e.target.value)} options={WAREHOUSES} className="w-full sm:w-40" />
        </div>
      </div>

      {loading && <div className="flex justify-center py-6"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}
      {!loading && filteredTransfers.length === 0 && <Card className="py-8 text-center text-sm text-gray-400">No transfers yet</Card>}

      <Card padding={false}>
        {filteredTransfers.map((t, i) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i < filteredTransfers.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
              <ArrowLeftRight className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.productName}</p>
              <p className="text-xs text-gray-400 truncate">{t.fromWarehouseName} → {t.toWarehouseName} · {formatDate(t.transferDate)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-gray-900">{t.qty} units</p>
              <Badge variant={t.status === "completed" ? "success" : "default"}>{t.status}</Badge>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}