"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection, addDoc, getDocs, query, orderBy,
  serverTimestamp, Timestamp, doc, updateDoc, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dropdown } from "@/components/ui/Dropdown";
import { Modal } from "@/components/ui/Modal";
import {
  ArrowLeft, Plus, Trash2, Search,
  FileText, Store, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────

interface Shop {
  id: string; name: string; ownerName: string; city?: string; phone?: string;
}
interface Product {
  id: string; name: string; sku: string; unitPrice: number; type: string;
}
interface LineItem {
  productId:   string;
  productName: string;
  productSku:  string;
  unitPrice:   number;
  qty:         number;
  total:       number;
}

// ── Payment options ───────────────────────────────────────

const PAYMENT_OPTIONS = [
  { value: "cash",       label: "💵 Cash",               desc: "Paid immediately"        },
  { value: "card",       label: "💳 Card payment",        desc: "Debit / credit card"     },
  { value: "cheque_15d", label: "🏦 Cheque (15 days)",    desc: "Due in 15 days"          },
  { value: "cheque_30d", label: "🏦 Cheque (30 days)",    desc: "Due in 30 days"          },
  { value: "cheque_60d", label: "🏦 Cheque (60 days)",    desc: "Due in 60 days"          },
  { value: "cheque_90d", label: "🏦 Cheque (90 days)",    desc: "Due in 90 days"          },
  { value: "pending",    label: "⏳ Pending / Credit",    desc: "Payment to be collected" },
];

// ── Auto-generate invoice number ──────────────────────────

function generateInvoiceNo(existingCount: number): string {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = String(now.getMonth() + 1).padStart(2, "0");
  const day    = String(now.getDate()).padStart(2, "0");
  const seq    = String(existingCount + 1).padStart(4, "0");
  // Format: INV-YYYYMMDD-0001
  return `INV-${year}${month}${day}-${seq}`;
}

// ── Shop picker modal ─────────────────────────────────────

function ShopPickerModal({ onSelect, onClose }: {
  onSelect: (shop: Shop) => void;
  onClose:  () => void;
}) {
  const [shops, setShops]   = useState<Shop[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "shops"), orderBy("name")))
      .then(snap => {
        setShops(snap.docs.map(d => ({ id: d.id, ...d.data() } as Shop)));
        setLoading(false);
      });
  }, []);

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal title="Select shop" onClose={onClose} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, owner or city..."
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        )}

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.map(shop => (
            <button key={shop.id} onClick={() => onSelect(shop)}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 px-4 py-3 text-left transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 flex-shrink-0">
                <Store className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{shop.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {shop.ownerName}{shop.city ? ` · ${shop.city}` : ""}
                </p>
              </div>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No shops found</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Product picker modal ──────────────────────────────────

function ProductPickerModal({ onSelect, onClose, warehouseId }: {
  onSelect:    (product: Product) => void;
  onClose:     () => void;
  warehouseId: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch]     = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "products"), orderBy("name")))
      .then(snap => {
        setProducts(snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Product))
          .filter(p => (p as any).active !== false)
        );
        setLoading(false);
      });
  }, []);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal title="Select product" onClose={onClose} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full rounded-xl border border-gray-200 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          </div>
        )}

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.map(product => (
            <button key={product.id} onClick={() => onSelect(product)}
              className="w-full flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-brand-50 hover:border-brand-200 px-4 py-3 text-left transition-colors">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-200 flex-shrink-0">
                <Package className="h-4 w-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-gray-400">{product.sku}</p>
              </div>
              <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                Rs {product.unitPrice?.toLocaleString()}
              </p>
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No products found</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Cheque details form ───────────────────────────────────

function ChequeDetails({ bank, chequeNo, onChange }: {
  bank: string; chequeNo: string;
  onChange: (field: "bank" | "chequeNo", value: string) => void;
}) {
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">Cheque details</p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Bank name"
          value={bank}
          onChange={e => onChange("bank", e.target.value)}
          placeholder="e.g. People's Bank"
        />
        <Input
          label="Cheque number"
          value={chequeNo}
          onChange={e => onChange("chequeNo", e.target.value)}
          placeholder="e.g. 001234"
        />
      </div>
      <p className="text-xs text-amber-700">
        A cheque record will be created automatically with the due date.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function NewInvoicePage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { appUser }  = useAuth();

  // Pre-fill shop from query params (coming from shop detail page)
  const preShopId   = searchParams.get("shopId");
  const preShopName = searchParams.get("shopName");

  const [selectedShop, setSelectedShop]   = useState<Shop | null>(
    preShopId && preShopName
      ? { id: preShopId, name: decodeURIComponent(preShopName), ownerName: "", city: "" }
      : null
  );
  const [showShopPicker, setShowShopPicker]       = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [items, setItems]                         = useState<LineItem[]>([]);
  const [paymentType, setPaymentType]             = useState("cash");
  const [invoiceDate, setInvoiceDate]             = useState(new Date().toISOString().split("T")[0]);
  const [warehouseId, setWarehouseId]             = useState("");
  const [warehouses, setWarehouses]               = useState<{ value: string; label: string }[]>([]);
  const [notes, setNotes]                         = useState("");
  const [chequeBank, setChequeBank]               = useState("");
  const [chequeNo, setChequeNo]                   = useState("");
  const [saving, setSaving]                       = useState(false);
  const [error, setError]                         = useState("");
  const [invoiceNo, setInvoiceNo]                 = useState("");

  const isCheque  = paymentType.startsWith("cheque_");
  const isPending = paymentType === "pending";
  const totalAmount = items.reduce((s, i) => s + i.total, 0);

  // Load warehouses
  useEffect(() => {
    getDocs(collection(db, "warehouses")).then(snap => {
      const opts = snap.docs.map(d => ({ value: d.id, label: (d.data() as any).name }));
      setWarehouses(opts);
      if (opts.length > 0) setWarehouseId(opts[0].value);
    });
  }, []);

  // Auto-generate invoice number on mount
  useEffect(() => {
    async function genInvoiceNo() {
      const snap = await getDocs(collection(db, "invoices"));
      setInvoiceNo(generateInvoiceNo(snap.size));
    }
    genInvoiceNo();
  }, []);

  function addProduct(product: Product) {
    setShowProductPicker(false);
    // If already in list, increase qty
    const existing = items.findIndex(i => i.productId === product.id);
    if (existing >= 0) {
      setItems(prev => prev.map((item, idx) =>
        idx === existing
          ? { ...item, qty: item.qty + 1, total: (item.qty + 1) * item.unitPrice }
          : item
      ));
      return;
    }
    setItems(prev => [...prev, {
      productId:   product.id,
      productName: product.name,
      productSku:  product.sku,
      unitPrice:   product.unitPrice,
      qty:         1,
      total:       product.unitPrice,
    }]);
  }

  function updateQty(index: number, qty: number) {
    if (qty < 1) return;
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, qty, total: qty * item.unitPrice } : item
    ));
  }

  function updatePrice(index: number, price: number) {
    if (price < 0) return;
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, unitPrice: price, total: item.qty * price } : item
    ));
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop)  { setError("Please select a shop."); return; }
    if (items.length === 0) { setError("Add at least one product."); return; }
    if (!warehouseId)   { setError("Please select a warehouse."); return; }
    if (isCheque && (!chequeBank.trim() || !chequeNo.trim())) {
      setError("Please enter bank name and cheque number."); return;
    }

    setSaving(true); setError("");

    try {
      const warehouseName = warehouses.find(w => w.value === warehouseId)?.label ?? "";
      const invDate       = new Date(invoiceDate);

      // Create invoice
      const invoiceRef = await addDoc(collection(db, "invoices"), {
        invoiceNo,
        shopId:        selectedShop.id,
        shopName:      selectedShop.name,
        warehouseId,
        warehouseName,
        items:         items.map(i => ({
          productId:   i.productId,
          productName: i.productName,
          productSku:  i.productSku,
          qty:         i.qty,
          unitPrice:   i.unitPrice,
          total:       i.total,
        })),
        totalAmount,
        paymentType,
        status:        "confirmed",
        notes:         notes.trim() || null,
        invoiceDate:   Timestamp.fromDate(invDate),
        createdBy:     appUser?.uid ?? "",
        createdAt:     serverTimestamp(),
      });

      // Deduct stock for each item
      for (const item of items) {
        const stockId  = `${warehouseId}_${item.productId}`;
        const stockRef = doc(db, "stock", stockId);
        try {
          await updateDoc(stockRef, {
            qty:       increment(-item.qty),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Stock record might not exist — ignore
        }
      }

      // Create cheque record if cheque payment
      if (isCheque) {
        const days = parseInt(paymentType.replace("cheque_", "").replace("d", ""));
        const due  = new Date(invDate);
        due.setDate(due.getDate() + days);

        await addDoc(collection(db, "cheques"), {
          shopId:    selectedShop.id,
          shopName:  selectedShop.name,
          invoiceId: invoiceRef.id,
          invoiceNo,
          bank:      chequeBank.trim(),
          chequeNo:  chequeNo.trim(),
          amount:    totalAmount,
          dueDate:   Timestamp.fromDate(due),
          status:    "pending",
          createdAt: serverTimestamp(),
        });
      }

      // For pending — add to outstanding balance
      if (isPending) {
        try {
          await updateDoc(doc(db, "shops", selectedShop.id), {
            outstandingBalance: increment(totalAmount),
            updatedAt:          serverTimestamp(),
          });
        } catch {}
      }

      router.push(`/dashboard/invoices/${invoiceRef.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-medium text-gray-900">New invoice</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">Invoice no:</span>
            <span className="text-xs font-mono font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
              {invoiceNo || "Generating..."}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Invoice date */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Invoice date
              </label>
              <input
                type="date"
                value={invoiceDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>
            <div className="flex-1 min-w-0">
              <Dropdown
                label="Warehouse *"
                value={warehouseId}
                onChange={setWarehouseId}
                options={warehouses}
                placeholder="Select warehouse..."
              />
            </div>
          </div>
        </Card>

        {/* Shop selector */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Shop *</p>
            <button type="button" onClick={() => setShowShopPicker(true)}
              className="text-xs text-brand-600 hover:underline font-medium">
              {selectedShop ? "Change" : "Select shop"}
            </button>
          </div>
          {selectedShop ? (
            <div className="flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-brand-200 flex-shrink-0">
                <Store className="h-4 w-4 text-brand-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-900">{selectedShop.name}</p>
                {selectedShop.ownerName && (
                  <p className="text-xs text-brand-600">{selectedShop.ownerName}</p>
                )}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowShopPicker(true)}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 px-4 py-4 text-gray-400 hover:text-brand-600 transition-colors">
              <Store className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">Tap to select a shop</span>
            </button>
          )}
        </Card>

        {/* Line items */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Products *</p>
              {items.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {items.length} item{items.length > 1 ? "s" : ""} · {items.reduce((s,i) => s + i.qty, 0)} units
                </p>
              )}
            </div>
            <button type="button" onClick={() => setShowProductPicker(true)}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-2 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
          </div>

          {items.length === 0 && (
            <button type="button" onClick={() => setShowProductPicker(true)}
              className="w-full flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 px-4 py-4 text-gray-400 hover:text-brand-600 transition-colors">
              <Package className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">Tap to add products</span>
            </button>
          )}

          <div className="space-y-3">
            {items.map((item, i) => (
              <div key={item.productId}
                className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                    <p className="text-xs text-gray-400">{item.productSku}</p>
                  </div>
                  <button type="button" onClick={() => removeItem(i)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors flex-shrink-0">
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Qty</label>
                    <div className="flex items-center gap-1">
                      <button type="button"
                        onClick={() => updateQty(i, item.qty - 1)}
                        className="h-8 w-8 flex-shrink-0 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600 font-bold">
                        −
                      </button>
                      <input
                        type="number" min={1} value={item.qty}
                        onChange={e => updateQty(i, parseInt(e.target.value) || 1)}
                        className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:border-brand-400"
                      />
                      <button type="button"
                        onClick={() => updateQty(i, item.qty + 1)}
                        className="h-8 w-8 flex-shrink-0 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600 font-bold">
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Unit price (Rs)</label>
                    <input
                      type="number" min={0} value={item.unitPrice}
                      onChange={e => updatePrice(i, parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Total (Rs)</label>
                    <div className="rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-900">
                      {item.total.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Total</p>
              <p className="text-lg font-semibold text-gray-900">
                Rs {totalAmount.toLocaleString()}
              </p>
            </div>
          )}
        </Card>

        {/* Payment type */}
        <Card>
          <p className="text-sm font-medium text-gray-700 mb-3">Payment type *</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PAYMENT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentType(opt.value)}
                className={cn(
                  "flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors",
                  paymentType === opt.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <span className="text-sm font-medium text-gray-900 truncate w-full">
                  {opt.label}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 truncate w-full">
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Cheque details */}
          {isCheque && (
            <div className="mt-3">
              <ChequeDetails
                bank={chequeBank}
                chequeNo={chequeNo}
                onChange={(field, val) => {
                  if (field === "bank")     setChequeBank(val);
                  if (field === "chequeNo") setChequeNo(val);
                }}
              />
            </div>
          )}

          {/* Pending notice */}
          {isPending && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-800">
                This invoice will be added to the shop's outstanding balance and can be collected later.
              </p>
            </div>
          )}
        </Card>

        {/* Notes */}
        <Card>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Notes <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes about this invoice..."
            rows={3}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 resize-none"
          />
        </Card>

        {/* Summary */}
        {items.length > 0 && selectedShop && (
          <Card className="bg-gray-50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shop</span>
                <span className="font-medium text-gray-900 truncate ml-3">{selectedShop.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Items</span>
                <span className="font-medium text-gray-900">{items.length} products · {items.reduce((s,i)=>s+i.qty,0)} units</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment</span>
                <span className="font-medium text-gray-900">
                  {PAYMENT_OPTIONS.find(p => p.value === paymentType)?.label}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-2">
                <span className="font-medium text-gray-900">Total amount</span>
                <span className="text-lg font-semibold text-brand-700">
                  Rs {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pb-6">
          <Button variant="secondary" className="flex-1" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button className="flex-1" type="submit" loading={saving}
            disabled={!selectedShop || items.length === 0}>
            <FileText className="h-4 w-4" />
            Confirm invoice
          </Button>
        </div>
      </form>

      {/* Modals */}
      {showShopPicker && (
        <ShopPickerModal
          onSelect={shop => { setSelectedShop(shop); setShowShopPicker(false); }}
          onClose={() => setShowShopPicker(false)}
        />
      )}
      {showProductPicker && (
        <ProductPickerModal
          warehouseId={warehouseId}
          onSelect={addProduct}
          onClose={() => setShowProductPicker(false)}
        />
      )}
    </div>
  );
}