"use client";

import { useState } from "react";
import { useStock } from "@/hooks/useStock";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { AlertTriangle, ArrowLeftRight, Package } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Stock } from "@/types";
import {
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stockCol, transfersCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";

const WAREHOUSES = [
  { value: "",        label: "All warehouses" },
  { value: "kurunegala",    label: "Kurunegala"    },
  { value: "anuradhapura",  label: "Anuradhapura"  },
];

function StockBar({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  const pct = reorderLevel > 0 ? Math.min((qty / (reorderLevel * 3)) * 100, 100) : 50;
  const color =
    qty <= 0             ? "bg-gray-200"
    : qty <= reorderLevel ? "bg-red-500"
    : qty <= reorderLevel * 2 ? "bg-amber-400"
    : "bg-green-500";

  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
      <div
        className={cn("h-1.5 rounded-full transition-all", color)}
        style={{ width: `${Math.max(pct, 4)}%` }}
      />
    </div>
  );
}

function StockRow({ item }: { item: Stock }) {
  const isLow = item.qty <= item.reorderLevel;
  const isOut = item.qty === 0;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">
            {item.productName}
          </span>
          {isOut  && <Badge variant="danger">Out of stock</Badge>}
          {!isOut && isLow && <Badge variant="warning">Low</Badge>}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{item.productSku}</div>
        <StockBar qty={item.qty} reorderLevel={item.reorderLevel} />
      </div>
      <div className="text-right flex-shrink-0">
        <div className={cn("text-lg font-semibold", isLow ? "text-red-600" : "text-gray-900")}>
          {item.qty}
        </div>
        <div className="text-xs text-gray-400">units</div>
      </div>
    </div>
  );
}

function TransferModal({
  stock,
  onClose,
}: {
  stock: Stock[];
  onClose: () => void;
}) {
  const { appUser } = useAuth();
  const [fromWh, setFromWh]     = useState("kurunegala");
  const [toWh, setToWh]         = useState("anuradhapura");
  const [productId, setProduct] = useState("");
  const [qty, setQty]           = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState("");

  const fromStock = stock.filter((s) => s.warehouseId === fromWh);
  const selectedStock = fromStock.find((s) => s.productId === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStock) return;
    if (qty > selectedStock.qty) {
      setError(`Only ${selectedStock.qty} units available in ${fromWh}.`);
      return;
    }
    if (fromWh === toWh) {
      setError("Source and destination warehouse must be different.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Record the transfer request (Cloud Function will handle stock mutation)
      await addDoc(transfersCol, {
        fromWarehouseId:   fromWh,
        fromWarehouseName: WAREHOUSES.find((w) => w.value === fromWh)?.label ?? fromWh,
        toWarehouseId:     toWh,
        toWarehouseName:   WAREHOUSES.find((w) => w.value === toWh)?.label ?? toWh,
        productId:         selectedStock.productId,
        productName:       selectedStock.productName,
        productSku:        selectedStock.productSku,
        qty,
        status:            "completed",   // Phase 1: instant; Phase 2 add in_transit flow
        createdBy:         appUser?.uid ?? "unknown",
        transferDate:      serverTimestamp(),
        completedAt:       serverTimestamp(),
      });

      // Immediately adjust stock in a transaction (until Cloud Functions are set up)
      const fromDocId = `${fromWh}_${selectedStock.productId}`;
      const toDocId   = `${toWh}_${selectedStock.productId}`;

      await runTransaction(db, async (tx) => {
        const fromRef = doc(stockCol, fromDocId);
        const toRef   = doc(stockCol, toDocId);

        const fromSnap = await tx.get(fromRef);
        const toSnap   = await tx.get(toRef);

        if (!fromSnap.exists()) throw new Error("Source stock not found.");

        const fromQty = (fromSnap.data() as Stock).qty;
        if (fromQty < qty) throw new Error("Insufficient stock.");

        tx.update(fromRef, { qty: fromQty - qty, updatedAt: serverTimestamp() });

        if (toSnap.exists()) {
          tx.update(toRef, {
            qty: (toSnap.data() as Stock).qty + qty,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Create the stock doc for the destination if it doesn't exist yet
          tx.set(toRef, {
            ...fromSnap.data(),
            id:            toDocId,
            warehouseId:   toWh,
            warehouseName: WAREHOUSES.find((w) => w.value === toWh)?.label ?? toWh,
            qty,
            updatedAt:     serverTimestamp(),
          });
        }
      });

      onClose();
    } catch (err: any) {
      setError(err.message ?? "Transfer failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-md rounded-t-3xl md:rounded-2xl">
        <CardHeader
          title="Stock Transfer"
          subtitle="Move stock between warehouses"
          action={
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">✕</button>
          }
        />

        <form onSubmit={handleSubmit} className="space-y-3">
          <Select
            label="From warehouse"
            value={fromWh}
            onChange={(e) => { setFromWh(e.target.value); setProduct(""); }}
            options={WAREHOUSES.slice(1)}
          />
          <Select
            label="To warehouse"
            value={toWh}
            onChange={(e) => setToWh(e.target.value)}
            options={WAREHOUSES.slice(1)}
          />
          <Select
            label="Product"
            value={productId}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="Select product..."
            options={fromStock.map((s) => ({
              value: s.productId,
              label: `${s.productName} (${s.qty} available)`,
            }))}
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            max={selectedStock?.qty}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            hint={selectedStock ? `Max: ${selectedStock.qty} units` : undefined}
          />

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button className="flex-1" type="submit" loading={submitting} disabled={!productId}>
              Transfer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function InventoryPage() {
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch]           = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [tab, setTab] = useState<"all" | "bike" | "three_wheeler">("all");

  const { stock, lowStockItems, loading, error } = useStock({
    warehouseId: warehouseId || undefined,
  });

  const filtered = stock.filter((s) => {
    const matchSearch = s.productName.toLowerCase().includes(search.toLowerCase()) ||
                        s.productSku.toLowerCase().includes(search.toLowerCase());
    const matchTab    = tab === "all" || s.productType === tab;
    return matchSearch && matchTab;
  });

  // Group by warehouse for "all" view
  const byWarehouse = filtered.reduce<Record<string, Stock[]>>((acc, s) => {
    acc[s.warehouseName] = [...(acc[s.warehouseName] ?? []), s];
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500">{stock.length} SKUs across warehouses</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowTransfer(true)}
          className="gap-1.5"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Transfer
        </Button>
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} low on stock
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lowStockItems.map((s) => s.productName).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <Input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <Select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            options={WAREHOUSES}
            className="flex-1"
          />
          {/* Type tabs */}
          <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden text-sm">
            {(["all", "bike", "three_wheeler"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-2 font-medium transition-colors",
                  tab === t
                    ? "bg-brand-600 text-white"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t === "all" ? "All" : t === "bike" ? "Bike" : "3W"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock list */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load stock: {error}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <Package className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No stock found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search ? "Try a different search term" : "Add products to get started"}
          </p>
        </Card>
      )}

      {!loading && (
        warehouseId
          ? (
            <Card padding={false}>
              <div className="px-4 py-3 border-b border-gray-50">
                <span className="text-sm font-medium text-gray-700">
                  {WAREHOUSES.find((w) => w.value === warehouseId)?.label}
                </span>
              </div>
              <div className="px-4">
                {filtered.map((item) => (
                  <StockRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          )
          : Object.entries(byWarehouse).map(([whName, items]) => (
            <Card key={whName} padding={false} className="mb-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <span className="text-sm font-medium text-gray-700">{whName}</span>
                <span className="text-xs text-gray-400">
                  {items.reduce((sum, i) => sum + i.qty, 0)} units total
                </span>
              </div>
              <div className="px-4">
                {items.map((item) => (
                  <StockRow key={item.id} item={item} />
                ))}
              </div>
            </Card>
          ))
      )}

      {showTransfer && (
        <TransferModal
          stock={stock}
          onClose={() => setShowTransfer(false)}
        />
      )}
    </div>
  );
}
