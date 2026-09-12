"use client";

import { useState, useEffect } from "react";
import { useStock } from "@/hooks/useStock";
import { useAuth } from "@/hooks/useAuth";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";

import { useNotifications } from "@/hooks/useNotifications";

import {
  AlertTriangle,
  ArrowLeftRight,
  Package,
  Plus,
  Minus,
  Pencil,
  X,
  Check,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { Stock, Product, TyreType } from "@/types";

import {
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  runTransaction,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  stockCol,
  transfersCol,
  productsCol,
} from "@/lib/firestore-collections";

/* ============================================================
   CONSTANTS
============================================================ */

const WAREHOUSES = [
  { value: "", label: "All warehouses" },
  { value: "kurunegala", label: "Kurunegala" },
  { value: "anuradhapura", label: "Anuradhapura" },
];

const BRANDS = ["CEAT", "Other"];

/* ============================================================
   STOCK BAR
============================================================ */

function StockBar({
  qty,
  reorderLevel,
}: {
  qty: number;
  reorderLevel: number;
}) {
  const pct =
    reorderLevel > 0
      ? Math.min((qty / (reorderLevel * 3)) * 100, 100)
      : 50;

  const color =
    qty <= 0
      ? "bg-gray-200"
      : qty <= reorderLevel
      ? "bg-red-500"
      : qty <= reorderLevel * 2
      ? "bg-amber-500"
      : "bg-green-700";

  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
      <div
        className={cn(
          "h-1.5 rounded-full transition-all",
          color
        )}
        style={{
          width: `${Math.max(pct, 4)}%`,
        }}
      />
    </div>
  );
}

/* ============================================================
   ADJUST STOCK MODAL
============================================================ */

function AdjustStockModal({
  item,
  mode,
  onClose,
  onStockChanged,
}: {
  item: Stock;
  mode: "add" | "remove";
  onClose: () => void;
  onStockChanged: () => void;
}) {
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const maxRemove = item.qty;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (qty < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    if (mode === "remove" && qty > maxRemove) {
      setError(`Only ${maxRemove} units available.`);
      return;
    }

    setSaving(true);
    setError("");

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(stockCol, item.id);
        const snap = await tx.get(ref);

        if (!snap.exists()) {
          throw new Error("Stock record not found.");
        }

        const current = (snap.data() as Stock).qty ?? 0;

        const newQty =
          mode === "add"
            ? current + qty
            : Math.max(0, current - qty);

        tx.update(ref, {
          qty: newQty,
          updatedAt: serverTimestamp(),
        });
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

      await onStockChanged();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to update stock.");
    } finally {
      setSaving(false);
    }
  }

  const afterQty =
    mode === "add"
      ? item.qty + qty
      : Math.max(0, item.qty - qty);

  return (
    <Modal
      title={mode === "add" ? "Add stock" : "Remove stock"}
      subtitle={`${item.productName} · ${item.warehouseName}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex w-full gap-3">
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            className={cn(
              "min-h-12 flex-1 border-0 text-white",
              mode === "add"
                ? "bg-green-800 hover:bg-green-900"
                : "bg-red-800 hover:bg-red-900"
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
      <form
        id="adjust-stock-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* Current stock */}
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm text-gray-600">
            Current stock
          </span>

          <span
            className={cn(
              "text-lg font-semibold",
              item.qty <= item.reorderLevel
                ? "text-red-600"
                : "text-gray-900"
            )}
          >
            {item.qty} units
          </span>
        </div>

        {/* Quantity */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Quantity to {mode === "add" ? "add" : "remove"} *
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setQty((q) => Math.max(1, q - 1))
              }
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
            >
              <Minus className="h-4 w-4 text-gray-600" />
            </button>

            <input
              type="number"
              min={1}
              max={
                mode === "remove"
                  ? maxRemove
                  : undefined
              }
              value={qty}
              onChange={(e) =>
                setQty(
                  Math.max(
                    1,
                    parseInt(e.target.value) || 1
                  )
                )
              }
              className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-center text-lg font-semibold focus:border-brand-400 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setQty((q) => q + 1)}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50"
            >
              <Plus className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {mode === "remove" && (
            <p className="mt-1 text-xs text-gray-400">
              Max: {maxRemove} units
            </p>
          )}
        </div>

        {/* Preview */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl px-4 py-3",
            mode === "add"
              ? "bg-green-50"
              : "bg-red-50"
          )}
        >
          <span
            className={cn(
              "text-sm",
              mode === "add"
                ? "text-green-700"
                : "text-red-700"
            )}
          >
            After adjustment
          </span>

          <span
            className={cn(
              "text-lg font-semibold",
              mode === "add"
                ? "text-green-800"
                : "text-red-800"
            )}
          >
            {afterQty} units
          </span>
        </div>

        {/* Reason */}
        <Input
          label="Reason (optional)"
          placeholder={
            mode === "add"
              ? "e.g. New stock received from supplier"
              : "e.g. Damaged goods removed"
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ============================================================
   STOCK ROW
============================================================ */

function StockRow({
  item,
  canEdit,
  onDelete,
  onStockChanged,
}: {
  item: Stock;
  canEdit: boolean;
  onDelete: (item: Stock) => void;
  onStockChanged: () => void;
}) {
  const [adjustMode, setAdjustMode] = useState<
    "add" | "remove" | null
  >(null);

  const isLow = item.qty <= item.reorderLevel;
  const isOut = item.qty === 0;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className=" text-sm font-medium text-gray-900">
              {item.productName}
            </span>

            {isOut && (
              <Badge variant="danger">
                Out of stock
              </Badge>
            )}

            {!isOut && isLow && (
              <Badge variant="warning">
                Low
              </Badge>
            )}
          </div>

          <div className="mt-0.5 text-xs text-gray-400">
            {item.productSku}
          </div>

          <StockBar
            qty={item.qty}
            reorderLevel={item.reorderLevel}
          />
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="min-w-[40px] text-right">
            <div
              className={cn(
                "text-lg font-semibold",
                isLow
                  ? "text-red-600"
                  : "text-gray-900"
              )}
            >
              {item.qty}
            </div>

            <div className="text-xs text-gray-400">
              units
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setAdjustMode("add")}
                title="Add stock"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-green-200 bg-green-50 transition-colors hover:bg-green-100"
              >
                <Plus className="h-3.5 w-3.5 text-green-700" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setAdjustMode("remove")
                }
                title="Remove stock"
                disabled={isOut}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-red-50 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5 text-red-700" />
              </button>
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              title="Delete stock record"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors hover:border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {adjustMode && (
        <AdjustStockModal
          item={item}
          mode={adjustMode}
          onClose={() => setAdjustMode(null)}
          onStockChanged={onStockChanged}
        />
      )}
    </>
  );
}

/* ============================================================
   PRODUCT MODAL
============================================================ */

function ProductModal({
  existing,
  onClose,
}: {
  existing?: Product;
  onClose: () => void;
}) {
  const [name, setName] = useState(
    existing?.name ?? ""
  );

  const [brand, setBrand] = useState(
    existing?.brand ?? "CEAT"
  );

  const [customBrand, setCustom] = useState("");

  const [size, setSize] = useState(
    existing?.size ?? ""
  );

  const [type, setType] = useState<TyreType>(
    existing?.type ?? "bike"
  );

  const [tubeType, setTubeType] = useState<
    "tube_type" | "tubeless"
  >("tube_type");

  const [unitPrice, setPrice] = useState(
    existing?.unitPrice ?? 0
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildName() {
    const b =
      brand === "Other"
        ? customBrand
        : brand;

    const tube =
      tubeType === "tubeless"
        ? "Tubeless"
        : "Tube Type";

    return `${size} ${b} ${tube}`.trim();
  }

  function buildSku() {
    const b =
      brand === "Other"
        ? customBrand
        : brand;

    const t =
      type === "bike"
        ? "BK"
        : "3W";

    const tube =
      tubeType === "tubeless"
        ? "TL"
        : "TT";

    return `${size
      .replace(/[^0-9./]/g, "")}-${b
      .toUpperCase()
      .slice(0, 4)}-${t}-${tube}`.replace(
      /\s/g,
      ""
    );
  }

  async function handleSave(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const finalBrand =
      brand === "Other"
        ? customBrand
        : brand;

    if (
      !size ||
      !finalBrand ||
      unitPrice <= 0
    ) {
      setError(
        "Size, brand and price are required."
      );
      return;
    }

    setSaving(true);
    setError("");

    const finalName =
      name || buildName();

    const sku =
      existing?.sku ?? buildSku();

    try {
      if (existing) {
        await updateDoc(
          doc(productsCol, existing.id),
          {
            name: finalName,
            brand: finalBrand,
            size,
            type,
            unitPrice,
            updatedAt: serverTimestamp(),
          }
        );
      } else {
        await addDoc(productsCol, {
          sku,
          name: finalName,
          brand: finalBrand,
          type,
          size,
          unitPrice,
          active: true,
          createdAt: serverTimestamp(),
        });
      }

      onClose();
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to save product."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        existing
          ? "Edit product"
          : "Add new product"
      }
      onClose={onClose}
      size="md"
      footer={
        <div className="flex w-full gap-3">
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            className="min-h-12 flex-1"
            type="submit"
            form="product-form"
            loading={saving}
          >
            {existing
              ? "Save changes"
              : "Add product"}
          </Button>
        </div>
      }
    >
      <form
        id="product-form"
        onSubmit={handleSave}
        className="space-y-4"
      >
        {/* Tyre type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Tyre type *
          </label>

          <div className="flex gap-2">
            {(
              [
                "bike",
                "three_wheeler",
              ] as TyreType[]
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "min-h-11 flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  type === t
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 bg-white text-gray-600"
                )}
              >
                {t === "bike"
                  ? "🏍 Bike"
                  : "🛺 3-Wheeler"}
              </button>
            ))}
          </div>
        </div>

        {/* Tube type */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Tube type *
          </label>

          <div className="flex gap-2">
            {(
              [
                "tube_type",
                "tubeless",
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setTubeType(t)
                }
                className={cn(
                  "min-h-11 flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                  tubeType === t
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 bg-white text-gray-600"
                )}
              >
                {t === "tube_type"
                  ? "Tube type"
                  : "Tubeless"}
              </button>
            ))}
          </div>
        </div>

        {/* Brand */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Brand *
          </label>

          <div className="flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
                className={cn(
                  "min-h-10 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                  brand === b
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 bg-white text-gray-600"
                )}
              >
                {b}
              </button>
            ))}
          </div>

          {brand === "Other" && (
            <input
              value={customBrand}
              onChange={(e) =>
                setCustom(e.target.value)
              }
              placeholder="Enter brand name"
              className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none"
            />
          )}
        </div>

        <Input
          label="Tyre size & Pattern *"
          placeholder={
            type === "bike"
              ? "e.g. 2.75-17 SECURA SPORT (R)"
              : "e.g. 400-8 BULAND"
          }
          value={size}
          onChange={(e) =>
            setSize(e.target.value)
          }
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Display name{" "}
            <span className="text-xs font-normal text-gray-400">
              (auto-filled)
            </span>
          </label>

          <input
            value={
              name || buildName()
            }
            onChange={(e) =>
              setName(e.target.value)
            }
            className="min-h-11 w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-brand-400 focus:outline-none"
          />
        </div>

        <Input
          label="Unit price (Rs) *"
          type="number"
          min={1}
          value={unitPrice || ""}
          onChange={(e) =>
            setPrice(
              parseFloat(e.target.value) || 0
            )
          }
          placeholder="e.g. 2800"
        />

        {!existing && (
          <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
            SKU:{" "}
            <span className="break-all font-mono font-medium text-gray-700">
              {buildSku()}
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ============================================================
   ADD STOCK MODAL
============================================================ */

function AddStockModal({
  products,
  onClose,
  onStockChanged,
}: {
  products: Product[];
  onClose: () => void;
  onStockChanged: () => void;
}) {
  const [productId, setProductId] =
    useState("");

  const [warehouseId, setWh] =
    useState("anuradhapura");

  const [qty, setQty] =
    useState(0);

  const [reorder, setReorder] =
    useState(10);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const selectedProduct =
    products.find(
      (p) => p.id === productId
    );

  async function handleSave(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!productId || qty < 1) {
      setError(
        "Select a product and enter quantity."
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const stockDocId = `${warehouseId}_${productId}`;

      const wh =
        WAREHOUSES.find(
          (w) =>
            w.value === warehouseId
        )!;

      const stockRef = doc(
        stockCol,
        stockDocId
      );

      await runTransaction(
        db,
        async (tx) => {
          const existing =
            await tx.get(stockRef);

          if (existing.exists()) {
            tx.update(stockRef, {
              qty:
                (existing.data() as Stock)
                  .qty + qty,
              reorderLevel: reorder,
              updatedAt:
                serverTimestamp(),
            });
          } else {
            tx.set(stockRef, {
              id: stockDocId,
              warehouseId,
              warehouseName:
                wh.label,
              productId,
              productName:
                selectedProduct?.name ??
                "",
              productSku:
                selectedProduct?.sku ??
                "",
              productType:
                selectedProduct?.type ??
                "bike",
              qty,
              reorderLevel: reorder,
              updatedAt:
                serverTimestamp(),
            });
          }
        }
      );

      await onStockChanged();

      onClose();
    } catch (err: any) {
      setError(
        err?.message ??
          "Failed to add stock."
      );
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
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            type="button"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            className="min-h-12 flex-1"
            type="submit"
            form="add-stock-form"
            loading={saving}
          >
            Add stock
          </Button>
        </div>
      }
    >
      <form
        id="add-stock-form"
        onSubmit={handleSave}
        className="space-y-4"
      >
        <Dropdown
          label="Product *"
          value={productId}
          onChange={setProductId}
          placeholder="Select product..."
          options={products.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
        />

        <Dropdown
          label="Warehouse *"
          value={warehouseId}
          onChange={setWh}
          options={WAREHOUSES.slice(1)}
        />

        <Input
          label="Quantity *"
          type="number"
          min={1}
          value={qty || ""}
          onChange={(e) =>
            setQty(
              parseInt(e.target.value) || 0
            )
          }
          placeholder="e.g. 50"
        />

        <Input
          label="Reorder alert level"
          type="number"
          min={1}
          value={reorder}
          onChange={(e) =>
            setReorder(
              parseInt(e.target.value) || 10
            )
          }
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ============================================================
   TRANSFER MODAL
============================================================ */

function TransferModal({
  stock,
  onClose,
}: {
  stock: Stock[];
  onClose: () => void;
}) {
  const { appUser } =
    useAuth();

  const [fromWh, setFromWh] =
    useState("kurunegala");

  const [toWh, setToWh] =
    useState("anuradhapura");

  const [productId, setProduct] =
    useState("");

  const [qty, setQty] =
    useState(1);

  const [submitting, setSub] =
    useState(false);

  const [error, setError] =
    useState("");

  const fromStock =
    stock.filter(
      (s) =>
        s.warehouseId === fromWh
    );

  const selectedStock =
    fromStock.find(
      (s) =>
        s.productId === productId
    );

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!selectedStock) {
      setError(
        "Please select a product."
      );
      return;
    }

    if (qty < 1) {
      setError(
        "Quantity must be at least 1."
      );
      return;
    }

    if (qty > selectedStock.qty) {
      setError(
        `Only ${selectedStock.qty} available.`
      );
      return;
    }

    if (fromWh === toWh) {
      setError(
        "Warehouses must be different."
      );
      return;
    }

    setSub(true);
    setError("");

    try {
      await addDoc(transfersCol, {
        fromWarehouseId: fromWh,
        fromWarehouseName:
          WAREHOUSES.find(
            (w) =>
              w.value === fromWh
          )?.label ?? fromWh,

        toWarehouseId: toWh,
        toWarehouseName:
          WAREHOUSES.find(
            (w) =>
              w.value === toWh
          )?.label ?? toWh,

        productId:
          selectedStock.productId,

        productName:
          selectedStock.productName,

        productSku:
          selectedStock.productSku,

        qty,
        status: "completed",

        createdBy:
          appUser?.uid ?? "",

        transferDate:
          serverTimestamp(),

        completedAt:
          serverTimestamp(),
      });

      const fromDocId =
        `${fromWh}_${selectedStock.productId}`;

      const toDocId =
        `${toWh}_${selectedStock.productId}`;

      await runTransaction(
        db,
        async (tx) => {
          const fromRef = doc(
            stockCol,
            fromDocId
          );

          const toRef = doc(
            stockCol,
            toDocId
          );

          const fromSnap =
            await tx.get(fromRef);

          const toSnap =
            await tx.get(toRef);

          if (!fromSnap.exists()) {
            throw new Error(
              "Source stock not found."
            );
          }

          const fromQty =
            (fromSnap.data() as Stock)
              .qty;

          if (fromQty < qty) {
            throw new Error(
              "Insufficient stock."
            );
          }

          tx.update(fromRef, {
            qty: fromQty - qty,
            updatedAt:
              serverTimestamp(),
          });

          if (toSnap.exists()) {
            tx.update(toRef, {
              qty:
                (toSnap.data() as Stock)
                  .qty + qty,
              updatedAt:
                serverTimestamp(),
            });
          } else {
            tx.set(toRef, {
              ...fromSnap.data(),

              id: toDocId,

              warehouseId: toWh,

              warehouseName:
                WAREHOUSES.find(
                  (w) =>
                    w.value === toWh
                )?.label ?? toWh,

              qty,

              updatedAt:
                serverTimestamp(),
            });
          }
        }
      );

      onClose();
    } catch (err: any) {
      setError(
        err?.message ??
          "Transfer failed."
      );
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
          <Button
            variant="secondary"
            className="min-h-12 flex-1"
            type="button"
            onClick={onClose}
            disabled={submitting}
          >
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
      <form
        id="transfer-stock-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Dropdown
          label="From warehouse"
          value={fromWh}
          onChange={(v) => {
            setFromWh(v);
            setProduct("");
          }}
          options={WAREHOUSES.slice(1)}
        />

        <Dropdown
          label="To warehouse"
          value={toWh}
          onChange={setToWh}
          options={WAREHOUSES.slice(1)}
        />

        <Dropdown
          label="Product"
          value={productId}
          onChange={setProduct}
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
          max={
            selectedStock?.qty
          }
          value={qty}
          onChange={(e) =>
            setQty(
              Number(e.target.value)
            )
          }
          hint={
            selectedStock
              ? `Max: ${selectedStock.qty} units`
              : undefined
          }
        />

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ============================================================
   MAIN INVENTORY PAGE
============================================================ */

type InventoryTab =
  | "stock"
  | "products";

export default function InventoryPage() {
  const { appUser } =
    useAuth();

  const canEdit =
    appUser?.role === "admin" ||
    appUser?.role === "sales_rep";

  const isAdmin =
    appUser?.role === "admin";

  const {
    refreshAlerts,
  } = useNotifications();

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<InventoryTab>(
      "stock"
    );

  const [
    warehouseId,
    setWarehouseId,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    tyreTab,
    setTyreTab,
  ] = useState<
    "all" | "bike" | "three_wheeler"
  >("all");

  const [
    showTransfer,
    setShowTransfer,
  ] = useState(false);

  const [
    showAddStock,
    setShowAddStock,
  ] = useState(false);

  const [
    showAddProduct,
    setShowAddProduct,
  ] = useState(false);

  const [
    editProduct,
    setEditProduct,
  ] =
    useState<Product | undefined>();

  const [
    deleteProduct,
    setDeleteProduct,
  ] =
    useState<Product | undefined>();

  const [
    deleteStock,
    setDeleteStock,
  ] =
    useState<Stock | undefined>();

  const {
    stock,
    lowStockItems,
    loading: stockLoading,
  } = useStock({
    warehouseId:
      warehouseId || undefined,
  });

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    prodLoading,
    setProdLoad,
  ] = useState(true);

  /* ---------------------------------------------------------
     PRODUCTS SNAPSHOT
  --------------------------------------------------------- */

  useEffect(() => {
    const q = query(
      productsCol,
      orderBy("name")
    );

    return onSnapshot(
      q,
      (snap) => {
        setProducts(
          snap.docs.map((d) => ({
            ...(d.data() as Product),
            id: d.id,
          }))
        );

        setProdLoad(false);
      },
      () => {
        setProdLoad(false);
      }
    );
  }, []);

  /* ---------------------------------------------------------
     DELETE PRODUCT
  --------------------------------------------------------- */

  async function handleDeleteProduct(
    p: Product
  ) {
    await deleteDoc(
      doc(productsCol, p.id)
    );

    setDeleteProduct(undefined);
  }

  /* ---------------------------------------------------------
     REFRESH ALERTS
  --------------------------------------------------------- */

  async function handleStockChanged() {
    await new Promise((resolve) =>
      setTimeout(resolve, 1000)
    );

    await refreshAlerts();
  }

  /* ---------------------------------------------------------
     DELETE STOCK
  --------------------------------------------------------- */

  async function handleDeleteStock(
    s: Stock
  ) {
    await deleteDoc(
      doc(stockCol, s.id)
    );

    setDeleteStock(undefined);
  }

  /* ---------------------------------------------------------
     TOGGLE PRODUCT
  --------------------------------------------------------- */

  async function toggleProductActive(
    p: Product
  ) {
    await updateDoc(
      doc(productsCol, p.id),
      {
        active: !p.active,
        updatedAt:
          serverTimestamp(),
      }
    );
  }

  /* ---------------------------------------------------------
     FILTER STOCK
  --------------------------------------------------------- */

  const filteredStock =
    stock.filter((s) => {
      const searchValue =
        search.toLowerCase();

      const matchSearch =
        s.productName
          .toLowerCase()
          .includes(searchValue) ||
        s.productSku
          ?.toLowerCase()
          .includes(searchValue);

      const matchTab =
        tyreTab === "all" ||
        s.productType === tyreTab;

      return (
        matchSearch &&
        matchTab
      );
    });

  /* ---------------------------------------------------------
     GROUP STOCK BY WAREHOUSE
  --------------------------------------------------------- */

  const byWarehouse =
    filteredStock.reduce<
      Record<string, Stock[]>
    >((acc, s) => {
      acc[s.warehouseName] = [
        ...(acc[s.warehouseName] ??
          []),
        s,
      ];

      return acc;
    }, {});

  /* ---------------------------------------------------------
     FILTER PRODUCTS
  --------------------------------------------------------- */

  const filteredProducts =
    products.filter((p) => {
      const searchValue =
        search.toLowerCase();

      return (
        p.name
          .toLowerCase()
          .includes(searchValue) ||
        p.sku
          ?.toLowerCase()
          .includes(searchValue)
      );
    });

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 md:p-6 md:pb-6">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-medium text-gray-900">
            INVENTORY
          </h1>

          <p className="text-sm text-gray-500">
            {stock.length} SKUs ·{" "}
            {
              products.filter(
                (p) => p.active
              ).length
            }{" "}
            products
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-shrink-0 gap-2">
            {activeTab === "stock" && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setShowAddStock(true)
                  }
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Add stock
                  </span>
                </Button>

                <Button
                  size="sm"
                  onClick={() =>
                    setShowTransfer(true)
                  }
                  className="gap-1.5"
                >
                  <ArrowLeftRight className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Transfer
                  </span>
                </Button>
              </>
            )}

            {activeTab ===
              "products" && (
              <Button
                size="sm"
                onClick={() =>
                  setShowAddProduct(true)
                }
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />

                <span className="hidden sm:inline">
                  Add product
                </span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          MAIN TABS
      ====================================================== */}

      <Tabs
        className="mb-4"
        active={activeTab}
        onChange={(k) => {
          setActiveTab(
            k as InventoryTab
          );

          setSearch("");
        }}
        options={[
          {
            key: "stock",
            label: "Stock levels",
          },
          {
            key: "products",
            label: "Product catalogue",
          },
        ]}
      />

      {/* ======================================================
          SEARCH
      ====================================================== */}

      <div className="mb-4">
        <Input
          placeholder={
            activeTab === "stock"
              ? "Search by name or SKU..."
              : "Search products..."
          }
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />
      </div>

      {/* ======================================================
          STOCK TAB
      ====================================================== */}

      {activeTab === "stock" && (
        <>
          {lowStockItems.length >
            0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />

              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {
                    lowStockItems.length
                  }{" "}
                  item
                  {lowStockItems.length >
                  1
                    ? "s"
                    : ""}{" "}
                  low on stock
                </p>

                <p className="mt-0.5 text-xs text-amber-700">
                  {lowStockItems
                    .map(
                      (s) =>
                        s.productName
                    )
                    .join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Dropdown
                value={warehouseId}
                onChange={
                  setWarehouseId
                }
                options={WAREHOUSES}
              />
            </div>

            <div className="flex flex-shrink-0 rounded-xl border border-gray-200 bg-white text-sm">
              {(
                [
                  "all",
                  "bike",
                  "three_wheeler",
                ] as const
              ).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    setTyreTab(t)
                  }
                  className={cn(
                    "px-3 py-2 font-medium transition-colors",
                    tyreTab === t
                      ? "bg-brand-700 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {t === "all"
                    ? "All"
                    : t === "bike"
                    ? "Bike"
                    : "3W"}
                </button>
              ))}
            </div>
          </div>

          {stockLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}

          {!stockLoading &&
            filteredStock.length ===
              0 && (
              <Card className="flex flex-col items-center py-12 text-center">
                <Package className="mb-3 h-10 w-10 text-gray-300" />

                <p className="text-sm text-gray-500">
                  No stock found
                </p>

                {canEdit && (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() =>
                      setShowAddStock(
                        true
                      )
                    }
                  >
                    Add stock
                  </Button>
                )}
              </Card>
            )}

          {!stockLoading && (
            <>
              {warehouseId ? (
                <Card
                  padding={false}
                >
                  <div className="border-b border-gray-50 px-4 py-3">
                    <span className="text-sm font-medium text-gray-700">
                      {
                        WAREHOUSES.find(
                          (w) =>
                            w.value ===
                            warehouseId
                        )?.label
                      }
                    </span>
                  </div>

                  <div className="px-4">
                    {filteredStock.map(
                      (item) => (
                        <StockRow
                          key={item.id}
                          item={item}
                          canEdit={
                            canEdit
                          }
                          onDelete={
                            setDeleteStock
                          }
                          onStockChanged={
                            handleStockChanged
                          }
                        />
                      )
                    )}
                  </div>
                </Card>
              ) : (
                Object.entries(
                  byWarehouse
                ).map(
                  ([
                    whName,
                    items,
                  ]) => (
                    <Card
                      key={whName}
                      padding={false}
                      className="mb-4"
                    >
                      <div className="flex items-center justify-between border-b border-gray-50 px-4 py-3">
                        <span className="text-sm font-medium text-gray-700">
                          {whName}
                        </span>

                        <span className="flex-shrink-0 text-xs text-gray-400">
                          {items.reduce(
                            (
                              s,
                              i
                            ) =>
                              s +
                              i.qty,
                            0
                          )}{" "}
                          units total
                        </span>
                      </div>

                      <div className="px-4">
                        {items.map(
                          (item) => (
                            <StockRow
                              key={
                                item.id
                              }
                              item={
                                item
                              }
                              canEdit={
                                canEdit
                              }
                              onDelete={
                                setDeleteStock
                              }
                              onStockChanged={
                                handleStockChanged
                              }
                            />
                          )
                        )}
                      </div>
                    </Card>
                  )
                )
              )}
            </>
          )}
        </>
      )}

      {/* ======================================================
          PRODUCTS TAB
      ====================================================== */}

      {activeTab ===
        "products" && (
        <>
          {prodLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}

          {!prodLoading &&
            filteredProducts.length ===
              0 && (
              <Card className="flex flex-col items-center py-12 text-center">
                <Package className="mb-3 h-10 w-10 text-gray-300" />

                <p className="text-sm text-gray-500">
                  No products yet
                </p>

                {canEdit && (
                  <Button
                    size="sm"
                    className="mt-4"
                    onClick={() =>
                      setShowAddProduct(
                        true
                      )
                    }
                  >
                    Add first product
                  </Button>
                )}
              </Card>
            )}

          {!prodLoading &&
            filteredProducts.length >
              0 && (
              <Card padding={false}>
                {filteredProducts.map(
                  (p, i) => (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        i <
                          filteredProducts.length -
                            1 &&
                          "border-b border-gray-50"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="whitespace-normal break-words text-sm font-medium leading-5 text-gray-900">
                            {p.name}
                          </p>

                          <Badge
                            variant={
                              p.type ===
                              "bike"
                                ? "info"
                                : "default"
                            }
                          >
                            {p.type ===
                            "bike"
                              ? "Bike"
                              : "3-Wheeler"}
                          </Badge>

                          {!p.active && (
                            <Badge variant="danger">
                              Inactive
                            </Badge>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-gray-400">
                          {p.sku} ·{" "}
                          {p.brand} · Rs{" "}
                          {p.unitPrice?.toLocaleString()}
                        </p>
                      </div>

                      {canEdit && (
                        <div className="flex flex-shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setEditProduct(
                                p
                              )
                            }
                            title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors hover:bg-gray-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-500" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              toggleProductActive(
                                p
                              )
                            }
                            title={
                              p.active
                                ? "Deactivate"
                                : "Activate"
                            }
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                              p.active
                                ? "border-gray-200 hover:border-amber-300 hover:bg-amber-50"
                                : "border-green-300 bg-green-50"
                            )}
                          >
                            {p.active ? (
                              <X className="h-3.5 w-3.5 text-gray-400" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            )}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteProduct(
                                  p
                                )
                              }
                              title="Delete"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 transition-colors hover:border-red-300 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </Card>
            )}
        </>
      )}

      {/* ======================================================
          MODALS
      ====================================================== */}

      {showTransfer && (
        <TransferModal
          stock={stock}
          onClose={() =>
            setShowTransfer(false)
          }
        />
      )}

      {showAddStock && (
        <AddStockModal
          products={products.filter(
            (p) =>
              p.active !== false
          )}
          onClose={() =>
            setShowAddStock(false)
          }
          onStockChanged={
            handleStockChanged
          }
        />
      )}

      {showAddProduct && (
        <ProductModal
          onClose={() =>
            setShowAddProduct(
              false
            )
          }
        />
      )}

      {editProduct && (
        <ProductModal
          existing={editProduct}
          onClose={() =>
            setEditProduct(
              undefined
            )
          }
        />
      )}

      {deleteProduct && (
        <DeleteConfirmDialog
          title="Delete product"
          description={`${deleteProduct.name} (${deleteProduct.sku})`}
          onConfirm={() =>
            handleDeleteProduct(
              deleteProduct
            )
          }
          onCancel={() =>
            setDeleteProduct(
              undefined
            )
          }
        />
      )}

      {deleteStock && (
        <DeleteConfirmDialog
          title="Delete stock record"
          description={`${deleteStock.productName} · ${deleteStock.warehouseName}\nCurrent qty: ${deleteStock.qty} units`}
          onConfirm={() =>
            handleDeleteStock(
              deleteStock
            )
          }
          onCancel={() =>
            setDeleteStock(
              undefined
            )
          }
        />
      )}
    </div>
  );
}