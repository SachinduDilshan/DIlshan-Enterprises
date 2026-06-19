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
import {
  AlertTriangle, ArrowLeftRight, Package,
  Plus, Minus, Pencil, X, Check, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stock, Product, TyreType } from "@/types";
import {
  addDoc, serverTimestamp, doc, updateDoc,
  runTransaction, collection, query, orderBy,
  onSnapshot, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stockCol, transfersCol, productsCol } from "@/lib/firestore-collections";

const WAREHOUSES = [
  { value: "", label: "All warehouses" },
  { value: "kurunegala", label: "Polonnaruwa" },
  { value: "anuradhapura", label: "Anuradhapura" },
];
const BRANDS = ["MRF", "CEAT", "Apollo", "Bridgestone", "TVS", "Bulland", "Other"];

// ── Stock bar ─────────────────────────────────────────────

function StockBar({ qty, reorderLevel }: { qty: number; reorderLevel: number }) {
  const pct = reorderLevel > 0 ? Math.min((qty / (reorderLevel * 3)) * 100, 100) : 50;
  const color = qty <= 0 ? "bg-gray-200" : qty <= reorderLevel ? "bg-red-500" : qty <= reorderLevel * 2 ? "bg-amber-400" : "bg-green-500";
  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100">
      <div className={cn("h-1.5 rounded-full transition-all", color)} style={{ width: `${Math.max(pct, 4)}%` }} />
    </div>
  );
}

// ── Stock row ─────────────────────────────────────────────

function StockRow({ item, canEdit, onDelete }: {
  item: Stock; canEdit: boolean; onDelete: (item: Stock) => void;
}) {
  const isLow = item.qty <= item.reorderLevel;
  const isOut = item.qty === 0;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{item.productName}</span>
          {isOut && <Badge variant="danger">Out of stock</Badge>}
          {!isOut && isLow && <Badge variant="warning">Low</Badge>}
        </div>
        <div className="text-xs text-gray-400 mt-0.5 truncate">{item.productSku}</div>
        <StockBar qty={item.qty} reorderLevel={item.reorderLevel} />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <div className={cn("text-lg font-semibold", isLow ? "text-red-600" : "text-gray-900")}>{item.qty}</div>
          <div className="text-xs text-gray-400">units</div>
        </div>
        {canEdit && (
          <button onClick={() => onDelete(item)} title="Delete stock record"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors">
            <Trash2 className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add/Edit product modal ────────────────────────────────

function ProductModal({ existing, onClose }: { existing?: Product; onClose: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "MRF");
  const [customBrand, setCustom] = useState("");
  const [size, setSize] = useState(existing?.size ?? "");
  const [type, setType] = useState<TyreType>(existing?.type ?? "bike");
  const [tubeType, setTubeType] = useState<"tube_type" | "tubeless">("tube_type");
  const [unitPrice, setPrice] = useState(existing?.unitPrice ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function buildName() {
    const b = brand === "Other" ? customBrand : brand;
    const tube = tubeType === "tubeless" ? "Tubeless" : "Tube Type";
    return `${size} ${b} ${tube}`.trim();
  }
  function buildSku() {
    const b = brand === "Other" ? customBrand : brand;
    const t = type === "bike" ? "BK" : "3W";
    const tube = tubeType === "tubeless" ? "TL" : "TT";
    return `${size.replace(/[^0-9./]/g, "")}-${b.toUpperCase().slice(0, 4)}-${t}-${tube}`.replace(/\s/g, "");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const finalBrand = brand === "Other" ? customBrand : brand;
    if (!size || !finalBrand || unitPrice <= 0) { setError("Size, brand and price are required."); return; }
    setSaving(true); setError("");
    const finalName = name || buildName();
    const sku = existing?.sku ?? buildSku();
    try {
      if (existing) {
        await updateDoc(doc(productsCol, existing.id), { name: finalName, brand: finalBrand, size, type, unitPrice, updatedAt: serverTimestamp() });
      } else {
        await addDoc(productsCol, { sku, name: finalName, brand: finalBrand, type, size, unitPrice, active: true, createdAt: serverTimestamp() });
      }
      onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={existing ? "Edit product" : "Add new product"} onClose={onClose} size="md">
      <form onSubmit={handleSave}>
        <div className="space-y-3">
          {/* Tyre type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tyre type *</label>
            <div className="flex gap-2">
              {(["bike", "three_wheeler"] as TyreType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={cn("flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors",
                    type === t ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600")}>
                  {t === "bike" ? "🏍 Bike" : "🛺 3-Wheeler"}
                </button>
              ))}
            </div>
          </div>

          {/* Tube type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tube type *</label>
            <div className="flex gap-2">
              {(["tube_type", "tubeless"] as const).map(t => (
                <button key={t} type="button" onClick={() => setTubeType(t)}
                  className={cn("flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors",
                    tubeType === t ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600")}>
                  {t === "tube_type" ? "Tube type" : "Tubeless"}
                </button>
              ))}
            </div>
          </div>

          {/* Brand */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Brand *</label>
            <div className="flex flex-wrap gap-2">
              {BRANDS.map(b => (
                <button key={b} type="button" onClick={() => setBrand(b)}
                  className={cn("rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                    brand === b ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600")}>
                  {b}
                </button>
              ))}
            </div>
            {brand === "Other" && (
              <input value={customBrand} onChange={e => setCustom(e.target.value)}
                placeholder="Enter brand name"
                className="mt-2 w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400" />
            )}
          </div>

          <Input label="Tyre size *"
            placeholder={type === "bike" ? "e.g. 2.75-17" : "e.g. 400-8"}
            value={size} onChange={e => setSize(e.target.value)} />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Display name <span className="text-gray-400 font-normal text-xs">(auto-filled)</span>
            </label>
            <input value={name || buildName()} onChange={e => setName(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400" />
          </div>

          <Input label="Unit price (Rs) *" type="number" min={1}
            value={unitPrice || ""} onChange={e => setPrice(parseFloat(e.target.value) || 0)}
            placeholder="e.g. 2800" />

          {!existing && (
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500">
              SKU: <span className="font-mono font-medium text-gray-700 break-all">{buildSku()}</span>
            </div>
          )}

          {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

          <div className="flex gap-3 pt-2 pb-1">
            <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" type="submit" loading={saving}>
              {existing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ── Add stock modal ───────────────────────────────────────

function AddStockModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
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
    setSaving(true); setError("");
    try {
      const stockDocId = `${warehouseId}_${productId}`;
      const wh = WAREHOUSES.find(w => w.value === warehouseId)!;
      const stockRef = doc(stockCol, stockDocId);
      await runTransaction(db, async tx => {
        const existing = await tx.get(stockRef);
        if (existing.exists()) {
          tx.update(stockRef, {
            qty: (existing.data() as Stock).qty + qty,
            reorderLevel: reorder,
            updatedAt: serverTimestamp(),
          });
        } else {
          tx.set(stockRef, {
            id: stockDocId, warehouseId, warehouseName: wh.label,
            productId, productName: selectedProduct?.name ?? "",
            productSku: selectedProduct?.sku ?? "", productType: selectedProduct?.type ?? "bike",
            qty, reorderLevel: reorder, updatedAt: serverTimestamp(),
          });
        }
      });
      onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Add stock to warehouse" onClose={onClose} size="sm">
      <form onSubmit={handleSave} className="space-y-3">
        <Dropdown label="Product *" value={productId} onChange={setProductId}
          placeholder="Select product..."
          options={products.map(p => ({ value: p.id, label: p.name }))} />
        <Dropdown label="Warehouse *" value={warehouseId} onChange={setWh}
          options={WAREHOUSES.slice(1)} />
        <Input label="Quantity *" type="number" min={1}
          value={qty || ""} onChange={e => setQty(parseInt(e.target.value) || 0)}
          placeholder="e.g. 50" />
        <Input label="Reorder alert level" type="number" min={1}
          value={reorder} onChange={e => setReorder(parseInt(e.target.value) || 10)} />
        {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        {/* Sticky action buttons */}
        <div className="flex gap-3 pt-2 pb-1">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={saving}>Add stock</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Transfer modal ────────────────────────────────────────

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
    if (!selectedStock) return;
    if (qty > selectedStock.qty) { setError(`Only ${selectedStock.qty} available.`); return; }
    if (fromWh === toWh) { setError("Warehouses must be different."); return; }
    setSub(true); setError("");
    try {
      await addDoc(transfersCol, {
        fromWarehouseId: fromWh, fromWarehouseName: WAREHOUSES.find(w => w.value === fromWh)?.label ?? fromWh,
        toWarehouseId: toWh, toWarehouseName: WAREHOUSES.find(w => w.value === toWh)?.label ?? toWh,
        productId: selectedStock.productId, productName: selectedStock.productName,
        productSku: selectedStock.productSku, qty, status: "completed",
        createdBy: appUser?.uid ?? "", transferDate: serverTimestamp(), completedAt: serverTimestamp(),
      });
      const fromDocId = `${fromWh}_${selectedStock.productId}`;
      const toDocId = `${toWh}_${selectedStock.productId}`;
      await runTransaction(db, async tx => {
        const fromRef = doc(stockCol, fromDocId);
        const toRef = doc(stockCol, toDocId);
        const fromSnap = await tx.get(fromRef);
        const toSnap = await tx.get(toRef);
        if (!fromSnap.exists()) throw new Error("Source stock not found.");
        const fromQty = (fromSnap.data() as Stock).qty;
        if (fromQty < qty) throw new Error("Insufficient stock.");
        tx.update(fromRef, { qty: fromQty - qty, updatedAt: serverTimestamp() });
        if (toSnap.exists()) {
          tx.update(toRef, { qty: (toSnap.data() as Stock).qty + qty, updatedAt: serverTimestamp() });
        } else {
          tx.set(toRef, {
            ...fromSnap.data(), id: toDocId, warehouseId: toWh,
            warehouseName: WAREHOUSES.find(w => w.value === toWh)?.label ?? toWh,
            qty, updatedAt: serverTimestamp(),
          });
        }
      });
      onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSub(false); }
  }

  return (
    <Modal title="Transfer stock" subtitle="Move stock between warehouses" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Dropdown label="From warehouse" value={fromWh}
          onChange={v => { setFromWh(v); setProduct(""); }}
          options={WAREHOUSES.slice(1)} />
        <Dropdown label="To warehouse" value={toWh} onChange={setToWh}
          options={WAREHOUSES.slice(1)} />
        <Dropdown label="Product" value={productId} onChange={setProduct}
          placeholder="Select product..."
          options={fromStock.map(s => ({
            value: s.productId,
            label: `${s.productName} (${s.qty} available)`,
          }))} />
        <Input label="Quantity" type="number" min={1} max={selectedStock?.qty}
          value={qty} onChange={e => setQty(Number(e.target.value))}
          hint={selectedStock ? `Max: ${selectedStock.qty} units` : undefined} />
        {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-2 pb-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} type="button">Cancel</Button>
          <Button className="flex-1" type="submit" loading={submitting} disabled={!productId}>Transfer</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main inventory page ───────────────────────────────────

type InventoryTab = "stock" | "products";

export default function InventoryPage() {
  const { appUser } = useAuth();
  const canEdit = appUser?.role === "admin" || appUser?.role === "sales_rep";
  const isAdmin = appUser?.role === "admin";

  const [activeTab, setActiveTab] = useState<InventoryTab>("stock");
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [tyreTab, setTyreTab] = useState<"all" | "bike" | "three_wheeler">("all");
  const [showTransfer, setShowTransfer] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [deleteProduct, setDeleteProduct] = useState<Product | undefined>();
  const [deleteStock, setDeleteStock] = useState<Stock | undefined>();

  const { stock, lowStockItems, loading: stockLoading } = useStock({ warehouseId: warehouseId || undefined });
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoad] = useState(true);

  useEffect(() => {
    const q = query(productsCol, orderBy("name"));
    return onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ ...(d.data() as Product), id: d.id })));
      setProdLoad(false);
    });
  }, []);

  async function handleDeleteProduct(p: Product) {
    await deleteDoc(doc(productsCol, p.id));
    setDeleteProduct(undefined);
  }

  async function handleDeleteStock(s: Stock) {
    await deleteDoc(doc(stockCol, s.id));
    setDeleteStock(undefined);
  }

  async function toggleProductActive(p: Product) {
    await updateDoc(doc(productsCol, p.id), { active: !p.active, updatedAt: serverTimestamp() });
  }

  const filteredStock = stock.filter(s => {
    const matchSearch = s.productName.toLowerCase().includes(search.toLowerCase()) ||
      s.productSku?.toLowerCase().includes(search.toLowerCase());
    const matchTab = tyreTab === "all" || s.productType === tyreTab;
    return matchSearch && matchTab;
  });

  const byWarehouse = filteredStock.reduce<Record<string, Stock[]>>((acc, s) => {
    acc[s.warehouseName] = [...(acc[s.warehouseName] ?? []), s];
    return acc;
  }, {});

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto w-full max-w-full">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-medium text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 truncate">
            {stock.length} SKUs · {products.filter(p => p.active).length} products
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-shrink-0">
            {activeTab === "stock" && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setShowAddStock(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add stock</span>
                </Button>
                <Button size="sm" onClick={() => setShowTransfer(true)} className="gap-1.5">
                  <ArrowLeftRight className="h-4 w-4" />
                  <span className="hidden sm:inline">Transfer</span>
                </Button>
              </>
            )}
            {activeTab === "products" && (
              <Button size="sm" onClick={() => setShowAddProduct(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add product</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="mb-4 flex rounded-xl border border-gray-200 overflow-hidden">
        {(["stock", "products"] as InventoryTab[]).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setSearch(""); }}
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors",
              activeTab === t ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700")}>
            {t === "stock" ? "Stock levels" : "Product catalogue"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder={activeTab === "stock" ? "Search by name or SKU..." : "Search products..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── STOCK TAB ── */}
      {activeTab === "stock" && (
        <>
          {lowStockItems.length > 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-800">
                  {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} low on stock
                </p>
                <p className="text-xs text-amber-700 mt-0.5 truncate">
                  {lowStockItems.map(s => s.productName).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="mb-4 flex gap-2 items-center">
            <div className="flex-1 min-w-0">
              <Dropdown
                value={warehouseId}
                onChange={setWarehouseId}
                options={WAREHOUSES}
              />
            </div>
            <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden text-sm flex-shrink-0">
              {(["all", "bike", "three_wheeler"] as const).map(t => (
                <button key={t} onClick={() => setTyreTab(t)}
                  className={cn("px-3 py-2 font-medium transition-colors",
                    tyreTab === t ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700")}>
                  {t === "all" ? "All" : t === "bike" ? "Bike" : "3W"}
                </button>
              ))}
            </div>
          </div>

          {stockLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}

          {!stockLoading && filteredStock.length === 0 && (
            <Card className="flex flex-col items-center py-12 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No stock found</p>
              {canEdit && (
                <Button size="sm" className="mt-4" onClick={() => setShowAddStock(true)}>
                  Add stock
                </Button>
              )}
            </Card>
          )}

          {!stockLoading && (
            warehouseId
              ? (
                <Card padding={false}>
                  <div className="px-4 py-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-700">
                      {WAREHOUSES.find(w => w.value === warehouseId)?.label}
                    </span>
                  </div>
                  <div className="px-4">
                    {filteredStock.map(item => (
                      <StockRow key={item.id} item={item} canEdit={canEdit} onDelete={setDeleteStock} />
                    ))}
                  </div>
                </Card>
              )
              : Object.entries(byWarehouse).map(([whName, items]) => (
                <Card key={whName} padding={false} className="mb-4">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-700">{whName}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {items.reduce((s, i) => s + i.qty, 0)} units total
                    </span>
                  </div>
                  <div className="px-4">
                    {items.map(item => (
                      <StockRow key={item.id} item={item} canEdit={canEdit} onDelete={setDeleteStock} />
                    ))}
                  </div>
                </Card>
              ))
          )}
        </>
      )}

      {/* ── PRODUCTS TAB ── */}
      {activeTab === "products" && (
        <>
          {prodLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
            </div>
          )}

          {!prodLoading && filteredProducts.length === 0 && (
            <Card className="flex flex-col items-center py-12 text-center">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No products yet</p>
              {canEdit && (
                <Button size="sm" className="mt-4" onClick={() => setShowAddProduct(true)}>
                  Add first product
                </Button>
              )}
            </Card>
          )}

          {!prodLoading && filteredProducts.length > 0 && (
            <Card padding={false}>
              {filteredProducts.map((p, i) => (
                <div key={p.id}
                  className={cn("flex items-center gap-3 px-4 py-3",
                    i < filteredProducts.length - 1 && "border-b border-gray-50")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      <Badge variant={p.type === "bike" ? "info" : "default"}>
                        {p.type === "bike" ? "Bike" : "3-Wheeler"}
                      </Badge>
                      {!p.active && <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {p.sku} · {p.brand} · Rs {p.unitPrice?.toLocaleString()}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setEditProduct(p)} title="Edit"
                        className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                        <Pencil className="h-3.5 w-3.5 text-gray-500" />
                      </button>
                      <button onClick={() => toggleProductActive(p)}
                        title={p.active ? "Deactivate" : "Activate"}
                        className={cn("h-7 w-7 flex items-center justify-center rounded-lg border transition-colors",
                          p.active ? "border-gray-200 hover:border-amber-300 hover:bg-amber-50" : "border-green-300 bg-green-50")}>
                        {p.active
                          ? <X className="h-3.5 w-3.5 text-gray-400" />
                          : <Check className="h-3.5 w-3.5 text-green-600" />}
                      </button>
                      {isAdmin && (
                        <button onClick={() => setDeleteProduct(p)} title="Delete"
                          className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* Modals */}
      {showTransfer && <TransferModal stock={stock} onClose={() => setShowTransfer(false)} />}
      {showAddStock && <AddStockModal products={products.filter(p => p.active !== false)} onClose={() => setShowAddStock(false)} />}
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