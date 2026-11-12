"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { ArrowLeftRight, Minus, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { stockCol, transfersCol, productsCol } from "@/lib/firestore-collections";
import { useStock } from "@/hooks/useStock";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatStrip } from "@/components/ui/StatStrip";
import type { StatItem } from "@/components/ui/StatStrip";
import { cn } from "@/lib/utils";
import type { Product, Stock, TyreType } from "@/types";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const WAREHOUSES = [
  { value: "", label: "All warehouses" },
  { value: "kurunegala", label: "Kurunegala" },
  { value: "anuradhapura", label: "Anuradhapura" },
];

const BRANDS = ["CEAT", "Other"];

const TYRE_TYPES: { value: TyreType; label: string; sizes: string }[] = [
  { value: "bike", label: "Bike", sizes: "e.g. 2.75-17, 3.00-17" },
  { value: "three_wheeler", label: "3-Wheeler", sizes: "e.g. 400-8, 4.00-8" },
  { value: "car", label: "Car", sizes: "e.g. 165/70 R13, 185/65 R15" },
  { value: "suv", label: "SUV / Jeep", sizes: "e.g. 215/65 R16, 265/70 R17" },
  { value: "van", label: "Van", sizes: "e.g. 195/70 R15, 165 R13" },
  { value: "truck", label: "Truck / Lorry", sizes: "e.g. 7.50-16, 10.00-20" },
  { value: "bus", label: "Bus", sizes: "e.g. 8.25-20, 9.00-20" },
  { value: "tractor", label: "Tractor", sizes: "e.g. 6.00-16, 7.50-16" },
  { value: "radial", label: "Radial", sizes: "e.g. 175/65 R14, 205/55 R16" },
];

const TUBE_TYPES = [
  { value: "tube_type", label: "Tube type" },
  { value: "tubeless", label: "Tubeless" },
];

const VEHICLE_OPTIONS = [
  { value: "", label: "All vehicle types" },
  ...TYRE_TYPES.map(t => ({ value: t.value as string, label: t.label })),
];

const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:h-10";
const btnOutline =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:h-10";
const btnSmall =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type StockStatus = "out" | "low" | "ok";

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stockStatus(s: Stock): StockStatus {
  const qty = numOr(s.qty, 0);
  const reorder = numOr(s.reorderLevel, 10);
  if (qty <= 0) return "out";
  if (qty <= reorder) return "low";
  return "ok";
}

function typeLabel(type?: string): string {
  return TYRE_TYPES.find(t => t.value === type)?.label ?? type ?? "";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */
/* Stock bar                                                           */
/* ------------------------------------------------------------------ */

function StockBar({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  const pct = reorderLevel > 0 ? Math.min((qty / (reorderLevel * 3)) * 100, 100) : 50;
  const color =
    qty <= 0 ? "bg-gray-300"
      : qty <= reorderLevel ? "bg-red-500"
        : qty <= reorderLevel * 2 ? "bg-amber-500"
          : "bg-emerald-600";
  return (
    <div aria-hidden="true" className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Adjust stock modal                                                  */
/* ------------------------------------------------------------------ */

function AdjustStockModal({
  item, mode, onClose, onStockChanged,
}: {
  item: Stock;
  mode: "add" | "remove";
  onClose: () => void;
  onStockChanged: () => void;
}) {
  const [qtyText, setQtyText] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const current = numOr(item.qty, 0);
  const parsed = parseInt(qtyText, 10);
  const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const afterQty = mode === "add" ? current + qty : Math.max(0, current - qty);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (qty < 1) { setError("Quantity must be at least 1."); return; }
    if (mode === "remove" && qty > current) { setError(`Only ${current} units available.`); return; }

    setSaving(true);
    setError("");
    try {
      await runTransaction(db, async tx => {
        const ref = doc(stockCol, item.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Stock record not found.");
        const latest = numOr((snap.data() as Stock).qty, 0);
        const newQty = mode === "add" ? latest + qty : Math.max(0, latest - qty);
        tx.update(ref, { qty: newQty, updatedAt: serverTimestamp() });
      });

      await addDoc(collection(db, "stockAdjustments"), {
        stockId: item.id,
        warehouseId: item.warehouseId,
        warehouseName: item.warehouseName,
        productId: item.productId,
        productName: item.productName,
        mode,
        qty,
        reason: reason.trim() || null,
        adjustedAt: serverTimestamp(),
      });

      onStockChanged();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={mode === "add" ? "Add stock" : "Remove stock"}
      subtitle={`${item.productName} · ${item.warehouseName}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="min-h-12 flex-1" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            className={cn(
              "min-h-12 flex-1 border-0 text-white",
              mode === "add" ? "bg-green-800 hover:bg-green-900" : "bg-red-800 hover:bg-red-900"
            )}
            type="submit"
            form="adjust-stock-form"
            loading={saving}
          >
            {mode === "add" ? "Add stock" : "Remove stock"}
          </Button>
        </div>
      }
    >
      <form id="adjust-stock-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">Current stock</span>
          <span className="text-lg font-semibold tabular-nums text-gray-900">{current} units</span>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Quantity to {mode === "add" ? "add" : "remove"} *
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQtyText(String(Math.max(1, qty - 1)))}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50"
            >
              <Minus className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={mode === "remove" ? current : undefined}
              value={qtyText}
              onChange={e => setQtyText(e.target.value)}
              onFocus={e => e.target.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 px-3 text-center text-lg font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQtyText(String(qty + 1))}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white hover:bg-gray-50"
            >
              <Plus className="h-4 w-4 text-gray-600" aria-hidden="true" />
            </button>
          </div>
          {mode === "remove" && <p className="mt-1 text-xs text-gray-500">Max: {current} units</p>}
        </div>

        <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">After adjustment</span>
          <span className="text-lg font-semibold tabular-nums text-gray-900">{afterQty} units</span>
        </div>

        <Input
          label="Reason (optional)"
          placeholder={mode === "add" ? "e.g. New stock received from supplier" : "e.g. Damaged goods removed"}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Stock row                                                           */
/* ------------------------------------------------------------------ */

function StockRow({
  item, canEdit, onDelete, onStockChanged,
}: {
  item: Stock;
  canEdit: boolean;
  onDelete: (item: Stock) => void;
  onStockChanged: () => void;
}) {
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | null>(null);

  const status = stockStatus(item);
  const qty = numOr(item.qty, 0);
  const reorder = numOr(item.reorderLevel, 10);

  const qtyBlock = (
    <>
      <p
        className={cn(
          "text-xl font-semibold tabular-nums",
          status === "out" ? "text-red-700" : status === "low" ? "text-amber-800" : "text-gray-900"
        )}
      >
        {qty}
      </p>
      <p className="text-xs text-gray-500">units</p>
    </>
  );

  return (
    <li className="px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                {status === "out" && <Badge variant="danger">Out of stock</Badge>}
                {status === "low" && <Badge variant="warning">Running low</Badge>}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {item.productSku}
                {item.productType ? ` · ${typeLabel(item.productType)}` : ""}
                {` · reorder at ${reorder}`}
              </p>
            </div>
            <div className="flex-shrink-0 text-right sm:hidden">{qtyBlock}</div>
          </div>
          <StockBar qty={qty} reorderLevel={reorder} />
        </div>

        <div className="hidden w-20 flex-shrink-0 text-right sm:block">{qtyBlock}</div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAdjustMode("add")} className={btnSmall}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdjustMode("remove")}
              disabled={status === "out"}
              className={btnSmall}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              aria-label={`Delete stock record for ${item.productName}`}
              title="Delete stock record"
              className={btnIcon}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {adjustMode && (
        <AdjustStockModal
          item={item}
          mode={adjustMode}
          onClose={() => setAdjustMode(null)}
          onStockChanged={onStockChanged}
        />
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Product modal                                                       */
/* ------------------------------------------------------------------ */

function ProductModal({ existing, onClose }: { existing?: Product; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "CEAT");
  const [customBrand, setCustom] = useState("");
  const [size, setSize] = useState(existing?.size ?? "");
  const [type, setType] = useState<TyreType>(existing?.type ?? "bike");
  const [tubeType, setTubeType] = useState<"tube_type" | "tubeless">("tube_type");
  const [unitPrice, setPrice] = useState(existing?.unitPrice ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedTypeInfo = TYRE_TYPES.find(t => t.value === type);

  function buildName() {
    const b = brand === "Other" ? customBrand : brand;
    const tube = tubeType === "tubeless" ? "Tubeless" : "Tube Type";
    return `${size} ${b} ${tube}`.trim();
  }

  function buildSku() {
    const b = brand === "Other" ? customBrand : brand;
    const typeCode: Record<TyreType, string> = {
      bike: "BK", three_wheeler: "3W", car: "CR", suv: "SV", van: "VN",
      truck: "TK", bus: "BS", tractor: "TR", radial: "RD",
    };
    const tube = tubeType === "tubeless" ? "TL" : "TT";
    return `${size.replace(/[^0-9./RrXx]/g, "")}-${b.toUpperCase().slice(0, 4)}-${typeCode[type]}-${tube}`
      .replace(/\s/g, "");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const finalBrand = brand === "Other" ? customBrand : brand;
    if (!size || !finalBrand || unitPrice <= 0) {
      setError("Size, brand and price are required.");
      return;
    }
    setSaving(true);
    setError("");
    const finalName = name || buildName();
    const sku = existing?.sku ?? buildSku();
    try {
      if (existing) {
        await updateDoc(doc(productsCol, existing.id), {
          name: finalName, brand: finalBrand, size, type, unitPrice,
          updatedAt: serverTimestamp(),
        });
      } else {
        const productRef = doc(productsCol);
        await setDoc(productRef, {
          id: productRef.id, sku, name: finalName, brand: finalBrand, type, size,
          unitPrice, active: true, createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "border-brand-600 bg-brand-50 text-brand-800"
        : "border-gray-300 text-gray-700 hover:bg-gray-50"
    );

  return (
    <Modal
      title={existing ? "Edit product" : "Add new product"}
      onClose={onClose}
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="product-form" loading={saving}>
            {existing ? "Save changes" : "Add product"}
          </Button>
        </div>
      }
    >
      <form id="product-form" onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Vehicle type *</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYRE_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} className={chip(type === t.value)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Construction *</label>
          <div className="flex gap-2">
            {TUBE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTubeType(t.value as "tube_type" | "tubeless")}
                className={cn(chip(tubeType === t.value), "flex-1")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Brand *</label>
          <div className="flex flex-wrap gap-2">
            {BRANDS.map(b => (
              <button key={b} type="button" onClick={() => setBrand(b)} className={chip(brand === b)}>
                {b}
              </button>
            ))}
          </div>
          {brand === "Other" && (
            <input
              value={customBrand}
              onChange={e => setCustom(e.target.value)}
              placeholder="Enter brand name"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          )}
        </div>

        <div>
          <Input
            label="Tyre size *"
            placeholder={selectedTypeInfo?.sizes ?? "e.g. 2.75-17"}
            value={size}
            onChange={e => setSize(e.target.value)}
          />
          {selectedTypeInfo && (
            <p className="mt-1 text-xs text-gray-500">
              {selectedTypeInfo.label}: {selectedTypeInfo.sizes}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Display name <span className="text-xs font-normal text-gray-500">(auto-filled)</span>
          </label>
          <input
            value={name || buildName()}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <Input
          label="Unit price (Rs) *"
          type="number"
          min={1}
          value={unitPrice || ""}
          onChange={e => setPrice(parseFloat(e.target.value) || 0)}
          placeholder="e.g. 12500"
        />

        {!existing && (
          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            SKU preview:
            <span className="ml-1 break-all font-mono font-medium text-gray-800">{buildSku()}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Add stock modal                                                     */
/* ------------------------------------------------------------------ */

function AddStockModal({
  products, onClose, onStockChanged,
}: {
  products: Product[];
  onClose: () => void;
  onStockChanged: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [warehouseId, setWh] = useState("anuradhapura");
  const [qty, setQty] = useState(0);
  const [reorder, setReorder] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedProduct = products.find(p => p.id === productId);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || qty < 1) { setError("Select a product and enter quantity."); return; }

    setSaving(true);
    setError("");
    try {
      const stockDocId = `${warehouseId}_${productId}`;
      const wh = WAREHOUSES.find(w => w.value === warehouseId)!;
      const stockRef = doc(stockCol, stockDocId);

      await runTransaction(db, async tx => {
        const existing = await tx.get(stockRef);
        if (existing.exists()) {
          tx.update(stockRef, {
            qty: numOr((existing.data() as Stock).qty, 0) + qty,
            reorderLevel: reorder,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(stockRef, {
            id: stockDocId,
            warehouseId,
            warehouseName: wh.label,
            productId,
            productName: selectedProduct?.name ?? "",
            productSku: selectedProduct?.sku ?? "",
            productType: selectedProduct?.type ?? "bike",
            qty,
            reorderLevel: reorder,
            updatedAt: serverTimestamp(),
          });
        }
      });

      onStockChanged();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to add stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add stock to warehouse"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="min-h-12 flex-1" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button className="min-h-12 flex-1" type="submit" form="add-stock-form" loading={saving}>
            Add stock
          </Button>
        </div>
      }
    >
      <form id="add-stock-form" onSubmit={handleSave} className="space-y-4">
        <Dropdown
          label="Product *"
          value={productId}
          onChange={setProductId}
          placeholder="Select product..."
          options={products.map(p => ({ value: p.id, label: p.name }))}
        />
        <Dropdown label="Warehouse *" value={warehouseId} onChange={setWh} options={WAREHOUSES.slice(1)} />
        <Input
          label="Quantity *"
          type="number"
          min={1}
          value={qty || ""}
          onChange={e => setQty(parseInt(e.target.value) || 0)}
          placeholder="e.g. 50"
        />
        <Input
          label="Reorder alert level"
          type="number"
          min={1}
          value={reorder}
          onChange={e => setReorder(parseInt(e.target.value) || 10)}
        />
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Transfer modal                                                      */
/* ------------------------------------------------------------------ */

function TransferModal({ stock, onClose }: { stock: Stock[]; onClose: () => void }) {
  const { appUser } = useAuth();

  const [fromWh, setFromWh] = useState("kurunegala");
  const [toWh, setToWh] = useState("anuradhapura");
  const [productId, setProduct] = useState("");
  const [qty, setQty] = useState(1);
  const [submitting, setSub] = useState(false);
  const [error, setError] = useState("");

  const fromStock = stock.filter(s => s.warehouseId === fromWh);
  const selectedStock = fromStock.find(s => s.productId === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStock) { setError("Please select a product."); return; }
    if (qty < 1) { setError("Quantity must be at least 1."); return; }
    if (qty > selectedStock.qty) { setError(`Only ${selectedStock.qty} available.`); return; }
    if (fromWh === toWh) { setError("Warehouses must be different."); return; }

    setSub(true);
    setError("");
    try {
      const toLabel = WAREHOUSES.find(w => w.value === toWh)?.label ?? toWh;
      const fromLabel = WAREHOUSES.find(w => w.value === fromWh)?.label ?? fromWh;
      const fromDocId = `${fromWh}_${selectedStock.productId}`;
      const toDocId = `${toWh}_${selectedStock.productId}`;

      // Move the stock first, so a failed transfer never leaves a record behind
      await runTransaction(db, async tx => {
        const fromRef = doc(stockCol, fromDocId);
        const toRef = doc(stockCol, toDocId);
        const fromSnap = await tx.get(fromRef);
        const toSnap = await tx.get(toRef);

        if (!fromSnap.exists()) throw new Error("Source stock not found.");
        const fromQty = numOr((fromSnap.data() as Stock).qty, 0);
        if (fromQty < qty) throw new Error("Insufficient stock.");

        tx.update(fromRef, { qty: fromQty - qty, updatedAt: serverTimestamp() });

        if (toSnap.exists()) {
          tx.update(toRef, {
            qty: numOr((toSnap.data() as Stock).qty, 0) + qty,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(toRef, {
            ...fromSnap.data(),
            id: toDocId,
            warehouseId: toWh,
            warehouseName: toLabel,
            qty,
            updatedAt: serverTimestamp(),
          });
        }
      });

      const transferRef = doc(transfersCol);
      await setDoc(transferRef, {
        id: transferRef.id,
        fromWarehouseId: fromWh,
        fromWarehouseName: fromLabel,
        toWarehouseId: toWh,
        toWarehouseName: toLabel,
        productId: selectedStock.productId,
        productName: selectedStock.productName,
        productSku: selectedStock.productSku,
        qty,
        status: "completed",
        createdBy: appUser?.uid ?? "",
        transferDate: serverTimestamp(),
        completedAt: serverTimestamp(),
      });

      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Transfer failed.");
    } finally {
      setSub(false);
    }
  }

  return (
    <Modal
      title="Transfer stock"
      subtitle="Move stock between warehouses"
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" className="min-h-12 flex-1" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            className="min-h-12 flex-1"
            type="submit"
            form="transfer-stock-form"
            loading={submitting}
            disabled={!productId}
          >
            Transfer
          </Button>
        </div>
      }
    >
      <form id="transfer-stock-form" onSubmit={handleSubmit} className="space-y-4">
        <Dropdown
          label="From warehouse"
          value={fromWh}
          onChange={v => { setFromWh(v); setProduct(""); }}
          options={WAREHOUSES.slice(1)}
        />
        <Dropdown label="To warehouse" value={toWh} onChange={setToWh} options={WAREHOUSES.slice(1)} />
        <Dropdown
          label="Product"
          value={productId}
          onChange={setProduct}
          placeholder="Select product..."
          options={fromStock.map(s => ({
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
          onChange={e => setQty(Number(e.target.value))}
          hint={selectedStock ? `Max: ${selectedStock.qty} units` : undefined}
        />
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type InventoryTab = "stock" | "products";
type StatusFilter = "all" | "low" | "out";

export default function InventoryPage() {
  const { appUser } = useAuth();
  const canEdit = appUser?.role === "admin" || appUser?.role === "sales_rep";
  const isAdmin = appUser?.role === "admin";
  const { refreshAlerts } = useNotifications();

  const [tab, setTab] = useState<InventoryTab>("stock");
  const [warehouseId, setWarehouseId] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [showTransfer, setShowTransfer] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [deleteProduct, setDeleteProduct] = useState<Product | undefined>();
  const [deleteStock, setDeleteStock] = useState<Stock | undefined>();

  const { stock, loading: stockLoading } = useStock({ warehouseId: warehouseId || undefined });

  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoad] = useState(true);

  useEffect(() => {
    const q = query(productsCol, orderBy("name"));
    return onSnapshot(
      q,
      snap => {
        setProducts(snap.docs.map(d => ({ ...(d.data() as Product), id: d.id })));
        setProdLoad(false);
      },
      () => setProdLoad(false)
    );
  }, []);

  /* ---------------- actions ---------------- */

  async function handleStockChanged() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await refreshAlerts();
  }

  async function handleDeleteProduct(p: Product) {
    await deleteDoc(doc(productsCol, p.id));
    setDeleteProduct(undefined);
  }

  async function handleDeleteStock(s: Stock) {
    await deleteDoc(doc(stockCol, s.id));
    setDeleteStock(undefined);
  }

  async function toggleProductActive(p: Product) {
    await updateDoc(doc(productsCol, p.id), {
      active: !p.active,
      updatedAt: serverTimestamp(),
    });
  }

  /* ---------------- derived ---------------- */

  const q = search.trim().toLowerCase();

  const stockStats = useMemo(() => {
    let units = 0;
    let low = 0;
    let out = 0;
    for (const s of stock) {
      units += numOr(s.qty, 0);
      const st = stockStatus(s);
      if (st === "low") low += 1;
      if (st === "out") out += 1;
    }
    return { units, low, out };
  }, [stock]);

  // Search and vehicle filters, before the status filter (so the pill counts stay accurate)
  const stockBase = useMemo(
    () =>
      stock.filter(s => {
        const matchSearch =
          !q ||
          s.productName?.toLowerCase().includes(q) ||
          s.productSku?.toLowerCase().includes(q);
        const matchVehicle = !vehicle || s.productType === vehicle;
        return matchSearch && matchVehicle;
      }),
    [stock, q, vehicle]
  );

  const baseCounts = useMemo(() => {
    let low = 0;
    let out = 0;
    for (const s of stockBase) {
      const st = stockStatus(s);
      if (st === "low") low += 1;
      if (st === "out") out += 1;
    }
    return { all: stockBase.length, low, out };
  }, [stockBase]);

  const stockShown = useMemo(() => {
    const rank: Record<StockStatus, number> = { out: 0, low: 1, ok: 2 };
    return stockBase
      .filter(s => statusFilter === "all" || stockStatus(s) === statusFilter)
      .sort((a, b) => {
        const diff = rank[stockStatus(a)] - rank[stockStatus(b)];
        return diff !== 0 ? diff : (a.productName ?? "").localeCompare(b.productName ?? "");
      });
  }, [stockBase, statusFilter]);

  const byWarehouse = useMemo(() => {
    const map = new Map<string, Stock[]>();
    for (const s of stockShown) {
      const key = s.warehouseName ?? "Unassigned";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return Array.from(map.entries());
  }, [stockShown]);

  const productsShown = useMemo(
    () =>
      products.filter(p => {
        const matchSearch =
          !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
        const matchVehicle = !vehicle || p.type === vehicle;
        return matchSearch && matchVehicle;
      }),
    [products, q, vehicle]
  );

  const activeProducts = products.filter(p => p.active !== false).length;
  const inactiveProducts = products.length - activeProducts;
  const loading = stockLoading || prodLoading;

  const kpis: StatItem[] = [
    {
      label: "Units on hand",
      value: stockStats.units.toLocaleString("en-LK"),
      hint: plural(stock.length, "SKU"),
    },
    {
      label: "Active products",
      value: String(activeProducts),
      hint: inactiveProducts > 0 ? `${inactiveProducts} inactive` : "In the catalogue",
    },
    {
      label: "Running low",
      value: String(stockStats.low),
      hint: stockStats.low > 0
        ? <span className="text-amber-700">At or below reorder level</span>
        : "None",
    },
    {
      label: "Out of stock",
      value: String(stockStats.out),
      hint: stockStats.out > 0
        ? <span className="text-red-700">Restock needed</span>
        : "None",
    },
  ];

  const hasStockFilters = q !== "" || vehicle !== "" || statusFilter !== "all" || warehouseId !== "";

  function clearFilters() {
    setSearch("");
    setVehicle("");
    setStatusFilter("all");
    setWarehouseId("");
  }

  const headerActions = canEdit && (
    <>
      {tab === "stock" ? (
        <>
          <button type="button" onClick={() => setShowTransfer(true)} className={btnOutline}>
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            Transfer
          </button>
          <button type="button" onClick={() => setShowAddStock(true)} className={btnPrimary}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add stock
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setShowAddProduct(true)} className={btnPrimary}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </button>
      )}
    </>
  );

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Inventory"
        description="Stock levels by warehouse and the product catalogue"
        actions={headerActions || undefined}
      />

      <StatStrip items={kpis} loading={loading} className="mb-6" />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div role="tablist" aria-label="Inventory sections" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {([
            { key: "stock", label: "Stock levels", count: stock.length },
            { key: "products", label: "Product catalogue", count: products.length },
          ] as { key: InventoryTab; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setStatusFilter("all"); }}
              className={cn(
                "flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-600 text-gray-900"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
              )}
            >
              {t.label}
              <span className="rounded-full bg-gray-100 px-1.5 text-xs tabular-nums text-gray-600">
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div
        className={cn(
          "mb-4 grid gap-3 sm:grid-cols-2",
          tab === "stock" ? "lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr]" : "lg:grid-cols-[minmax(0,1.4fr)_1fr]"
        )}
      >
        <div>
          <label htmlFor="inventory-search" className="mb-1 block text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              id="inventory-search"
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={tab === "stock" ? "Product name or SKU" : "Search products"}
              className="h-[42px] w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {tab === "stock" && (
          <Dropdown label="Warehouse" value={warehouseId} onChange={setWarehouseId} options={WAREHOUSES} />
        )}
        <Dropdown label="Vehicle type" value={vehicle} onChange={setVehicle} options={VEHICLE_OPTIONS} />
      </div>

      {/* ---------------- STOCK TAB ---------------- */}
      {tab === "stock" && (
        <>
          <div
            className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
            role="group"
            aria-label="Filter by stock status"
          >
            {([
              { key: "all", label: "All", count: baseCounts.all },
              { key: "low", label: "Running low", count: baseCounts.low },
              { key: "out", label: "Out of stock", count: baseCounts.out },
            ] as { key: StatusFilter; label: string; count: number }[]).map(f => (
              <button
                key={f.key}
                type="button"
                aria-pressed={statusFilter === f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  "inline-flex h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                  statusFilter === f.key
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    statusFilter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  )}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {stockLoading && (
            <Panel flush>
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            </Panel>
          )}

          {!stockLoading && stockShown.length === 0 && (
            <Panel>
              <div className="flex flex-col items-center py-10 text-center">
                <Package className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  {hasStockFilters ? "No stock matches these filters" : "No stock recorded yet"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {hasStockFilters
                    ? "Try a different search or clear the filters."
                    : "Add stock to a warehouse to start tracking levels."}
                </p>
                {hasStockFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 text-sm font-medium text-brand-700 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : (
                  canEdit && (
                    <button type="button" onClick={() => setShowAddStock(true)} className={cn(btnPrimary, "mt-4")}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add stock
                    </button>
                  )
                )}
              </div>
            </Panel>
          )}

          {!stockLoading && byWarehouse.length > 0 && (
            <div className="space-y-6">
              {byWarehouse.map(([whName, items]) => (
                <Panel
                  key={whName}
                  title={whName}
                  description={`${items
                    .reduce((s, i) => s + numOr(i.qty, 0), 0)
                    .toLocaleString("en-LK")} units · ${plural(items.length, "SKU")}`}
                  flush
                >
                  <ul className="divide-y divide-gray-100">
                    {items.map(item => (
                      <StockRow
                        key={item.id}
                        item={item}
                        canEdit={canEdit}
                        onDelete={setDeleteStock}
                        onStockChanged={handleStockChanged}
                      />
                    ))}
                  </ul>
                </Panel>
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------------- PRODUCTS TAB ---------------- */}
      {tab === "products" && (
        <>
          {prodLoading && (
            <Panel flush>
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            </Panel>
          )}

          {!prodLoading && productsShown.length === 0 && (
            <Panel>
              <div className="flex flex-col items-center py-10 text-center">
                <Package className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  {q || vehicle ? "No products match" : "No products yet"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {q || vehicle
                    ? "Try a different search or vehicle type."
                    : "Add your first product to the catalogue."}
                </p>
                {q || vehicle ? (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setVehicle(""); }}
                    className="mt-3 text-sm font-medium text-brand-700 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : (
                  canEdit && (
                    <button type="button" onClick={() => setShowAddProduct(true)} className={cn(btnPrimary, "mt-4")}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add product
                    </button>
                  )
                )}
              </div>
            </Panel>
          )}

          {!prodLoading && productsShown.length > 0 && (
            <Panel title={plural(productsShown.length, "product")} flush>
              <ul className="divide-y divide-gray-100">
                {productsShown.map(p => (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              p.active === false ? "text-gray-500" : "text-gray-900"
                            )}
                          >
                            {p.name}
                          </p>
                          <Badge>{typeLabel(p.type)}</Badge>
                          {p.active === false && <Badge variant="danger">Inactive</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {p.sku} · {p.brand} · Rs {p.unitPrice?.toLocaleString()}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setEditProduct(p)} className={btnSmall}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleProductActive(p)}
                            className={`${btnSmall} ${p.active === false
                                ? "text-green-700 hover:bg-green-50 border-green-200"
                                : "text-red-700 hover:bg-red-50 border-red-200"
                              }`}
                          >
                            {p.active === false ? "Activate" : "Deactivate"}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeleteProduct(p)}
                              aria-label={`Delete ${p.name}`}
                              title="Delete product"
                              className={btnIcon}
                            >
                              <Trash2 className="h-4 w-4 text-amber-500" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {/* Modals */}
      {showTransfer && <TransferModal stock={stock} onClose={() => setShowTransfer(false)} />}

      {showAddStock && (
        <AddStockModal
          products={products.filter(p => p.active !== false)}
          onClose={() => setShowAddStock(false)}
          onStockChanged={handleStockChanged}
        />
      )}

      {showAddProduct && <ProductModal onClose={() => setShowAddProduct(false)} />}

      {editProduct && <ProductModal existing={editProduct} onClose={() => setEditProduct(undefined)} />}

      {deleteProduct && (
        <DeleteConfirmDialog
          title="Delete product"
          description={`${deleteProduct.name} (${deleteProduct.sku})`}
          onConfirm={() => handleDeleteProduct(deleteProduct)}
          onCancel={() => setDeleteProduct(undefined)}
        />
      )}

      {deleteStock && (
        <DeleteConfirmDialog
          title="Delete stock record"
          description={`${deleteStock.productName} · ${deleteStock.warehouseName}\nCurrent qty: ${deleteStock.qty} units`}
          onConfirm={() => handleDeleteStock(deleteStock)}
          onCancel={() => setDeleteStock(undefined)}
        />
      )}
    </div>
  );
}