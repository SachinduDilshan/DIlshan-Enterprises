"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, doc, runTransaction, serverTimestamp,
  Timestamp, getDoc, collection, increment, setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { useProducts } from "@/hooks/useProducts";
import { useStock } from "@/hooks/useStock";
import { formatLKR } from "@/lib/utils";
import { invoicesCol, chequesCol, stockCol } from "@/lib/firestore-collections";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader } from "@/components/ui/Card";
import { Plus, Trash2, ArrowLeft, ChevronDown, Check } from "lucide-react";
import Link from "next/link";
import type { Product } from "@/types";

// ── Types ─────────────────────────────────────────────────

interface LineItem {
  productId:   string;
  productName: string;
  productSku:  string;
  qty:         number;
  unitPrice:   number;
}

// ── Payment options ───────────────────────────────────────

type InvoicePaymentType =
  | "cash"
  | "cheque_15d"
  | "cheque_30d"
  | "cheque_45d"
  | "cheque_60d";

type PaymentType = InvoicePaymentType | "card" | "pending";

const PAYMENT_OPTS: Array<{ value: PaymentType; label: string; desc: string; emoji: string }> = [
  { value: "cash",       label: "Cash",             desc: "Paid immediately",        emoji: "💵" },
  { value: "card",       label: "Card payment",     desc: "Debit / credit card",     emoji: "💳" },
  { value: "cheque_15d", label: "Cheque — 15 days", desc: "Due in 15 days",          emoji: "🏦" },
  { value: "cheque_30d", label: "Cheque — 30 days", desc: "Due in 30 days",          emoji: "🏦" },
  { value: "cheque_45d", label: "Cheque — 45 days", desc: "Due in 45 days",          emoji: "🏦" },
  { value: "cheque_60d", label: "Cheque — 60 days", desc: "Due in 60 days",          emoji: "🏦" },
  { value: "pending",    label: "Pending / Credit", desc: "Payment to be collected", emoji: "⏳" },
];

// ── Auto-generate invoice number ──────────────────────────

async function nextInvoiceNo(): Promise<string> {
  const now     = new Date();
  const year    = now.getFullYear();
  const month   = String(now.getMonth() + 1).padStart(2, "0");
  const day     = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const counterRef = doc(db, "counters", "invoices");
  const snap       = await getDoc(counterRef);
  const next       = (snap.exists() ? snap.data().count : 0) + 1;
  return `INV-${dateStr}-${String(next).padStart(4, "0")}`;
}

// ── Helper: days from payment type ───────────────────────

function daysFromPaymentType(paymentType: string): number | null {
  if (!paymentType.startsWith("cheque_")) return null;
  const days = parseInt(paymentType.replace("cheque_", "").replace("d", ""));
  return isNaN(days) ? null : days;
}

function dateStringFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ── Tyre name font size ───────────────────────────────────

function getTyreNameSize(name: string): string {
  const len = name.trim().length;
  if (len > 55) return "text-[9px]";
  if (len > 42) return "text-[10px]";
  if (len > 30) return "text-[11px]";
  return "text-xs";
}

// ── Custom tyre selector ──────────────────────────────────

interface TyreSelectProps {
  value:    string;
  products: Product[];
  onChange: (productId: string) => void;
}

function TyreSelect({ value, products, onChange }: TyreSelectProps) {
  const [open, setOpen]   = useState(false);
  const wrapperRef        = useRef<HTMLDivElement>(null);
  const selectedProduct   = products.find(p => p.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <span className={`min-w-0 flex-1 break-words whitespace-normal font-medium leading-4 text-brand-800 ${getTyreNameSize(selectedProduct?.name ?? "")}`}>
          {selectedProduct?.name ?? "Choose a tyre..."}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          {products.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No products available</p>
          )}
          {products.map(product => (
            <button key={product.id} type="button"
              onClick={() => { onChange(product.id); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <span className={`block font-medium text-gray-900 ${getTyreNameSize(product.name)}`}>
                  {product.name}
                </span>
                <span className="block text-[10px] text-gray-400 mt-0.5">
                  {product.sku} · Rs {product.unitPrice?.toLocaleString()}
                </span>
              </div>
              {product.id === value && <Check className="h-4 w-4 text-brand-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function NewInvoicePage() {
  const router      = useRouter();
  const { appUser } = useAuth();

  const { shops }    = useShops();
  const { products } = useProducts();
  const { stock }    = useStock();

  const [shopId, setShopId]           = useState("");
  const [lineItems, setLineItems]     = useState<LineItem[]>([]);
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [chequeNo, setChequeNo]       = useState("");
  const [bank, setBank]               = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  const [invoiceNo, setInvoiceNo]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  const isCheque  = paymentType.startsWith("cheque_");
  const isPending = paymentType === "pending";
  const isCard    = paymentType === "card";
  const total     = lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0);
  const selectedShop = shops.find(s => s.id === shopId) ?? null;

  // ── Auto-fill due date when cheque type changes ──────
  useEffect(() => {
    if (!isCheque) {
      setChequeDueDate("");
      return;
    }
    const days = daysFromPaymentType(paymentType);
    if (days !== null) {
      setChequeDueDate(dateStringFromDays(days));
    }
  }, [paymentType, isCheque]);

  // ── Generate invoice number on mount ────────────────
  useEffect(() => {
    nextInvoiceNo().then(setInvoiceNo);
  }, []);

  // ── Line item helpers ────────────────────────────────

  function addLine() {
    setLineItems(prev => [
      ...prev,
      { productId: "", productName: "", productSku: "", qty: 1, unitPrice: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => prev.map((li, i) => {
      if (i !== index) return li;
      if (field === "productId" && typeof value === "string") {
        const product = products.find(p => p.id === value);
        return {
          ...li,
          productId:   value,
          productName: product?.name      ?? "",
          productSku:  product?.sku       ?? "",
          unitPrice:   product?.unitPrice ?? 0,
        };
      }
      return { ...li, [field]: value };
    }));
  }

  // FIX: allow clearing input then typing fresh value
  function handleQtyChange(index: number, raw: string) {
    const val = raw === "" ? 1 : parseInt(raw);
    if (!isNaN(val) && val >= 1) {
      updateLine(index, "qty", val);
    }
  }

  function handlePriceChange(index: number, raw: string) {
    const val = raw === "" ? 0 : parseFloat(raw);
    if (!isNaN(val) && val >= 0) {
      updateLine(index, "unitPrice", val);
    }
  }

  function getAvailableStock(productId: string): number {
    return stock.find(s => s.productId === productId)?.qty ?? 0;
  }

  // ── Submit ───────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!shopId)              { setError("Please select a shop."); return; }
    if (lineItems.length === 0) { setError("Add at least one product."); return; }
    if (lineItems.find(li => !li.productId)) {
      setError("Please select a product for each line item."); return;
    }
    if (isCheque && (!chequeNo.trim() || !bank.trim())) {
      setError("Please enter the cheque number and bank name."); return;
    }
    if (isCheque && !chequeDueDate) {
      setError("Please select a cheque due date."); return;
    }

    // Check stock availability
    for (const li of lineItems) {
      const avail = getAvailableStock(li.productId);
      if (li.qty > avail) {
        setError(`Not enough stock for ${li.productName}. Available: ${avail}`);
        return;
      }
    }

    setSaving(true);

    try {
      // Store only the values allowed by the Firestore invoice schema.
      const invoicePaymentType: InvoicePaymentType =
        paymentType === "card" || paymentType === "pending" ? "cash" : paymentType;

      // 1. Increment counter atomically
      const counterRef = doc(db, "counters", "invoices");
      await runTransaction(db, async tx => {
        const snap = await tx.get(counterRef);
        const next = (snap.exists() ? snap.data().count : 0) + 1;
        tx.set(counterRef, { count: next }, { merge: true });
      });

      // 2. Create invoice using the full invoice schema expected by the Invoice type.
      const invoiceRef = doc(invoicesCol);
      await setDoc(invoiceRef, {
        id:          invoiceRef.id,
        invoiceNo,
        shopId,
        shopName:    selectedShop?.name ?? "",
        warehouseId: "",
        warehouseName: "",
        totalAmount: total,
        paymentType: invoicePaymentType,
        status:      "confirmed",
        notes:       "",
        invoiceDate: serverTimestamp(),
        createdBy:   appUser?.uid ?? "",
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });

      // 3. FIX: Deduct stock using correct stock document ID pattern
      for (const li of lineItems) {
        // Stock docs are keyed as warehouseId_productId
        // Find the matching stock doc by productId
        const matchingStock = stock.find(s => s.productId === li.productId);
        if (matchingStock) {
          const stockRef = doc(stockCol, matchingStock.id);
          await runTransaction(db, async tx => {
            const stockSnap = await tx.get(stockRef);
            if (stockSnap.exists()) {
              const current = (stockSnap.data() as any).qty ?? 0;
              tx.update(stockRef, {
                qty:       Math.max(0, current - li.qty),
                updatedAt: serverTimestamp(),
              });
            }
          });
        }
      }

      // 4. Create cheque record
      if (isCheque && chequeDueDate) {
        const due = new Date(chequeDueDate + "T23:59:59");
        const chequeRef = doc(chequesCol);
        await setDoc(chequeRef, {
          id:        chequeRef.id,
          shopId,
          shopName:  selectedShop?.name ?? "",
          invoiceId: invoiceRef.id,
          invoiceNo,
          chequeNo:  chequeNo.trim(),
          bank:      bank.trim(),
          amount:    total,
          dueDate:   Timestamp.fromDate(due),
          status:    "pending",
          createdAt: serverTimestamp(),
        });
      }

      // 5. Pending — update outstanding balance
      if (isPending) {
        try {
          const shopRef = doc(db, "shops", shopId);
          await runTransaction(db, async tx => {
            const shopSnap = await tx.get(shopRef);
            if (shopSnap.exists()) {
              tx.update(shopRef, {
                outstandingBalance: increment(total),
                updatedAt:          serverTimestamp(),
              });
            }
          });
        } catch {}
      }

      router.push(`/dashboard/invoices/${invoiceRef.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  // ── Shop options ─────────────────────────────────────

  const shopOptions = [
    { value: "", label: "Select a shop..." },
    ...shops.map(s => ({ value: s.id, label: s.name })),
  ];

  // ── Render ────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-20 md:p-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <button type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-medium text-gray-900">New invoice</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">Invoice no:</span>
            <span className="text-xs font-mono font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
              {invoiceNo || "Generating..."}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Shop */}
        <Card>
          <CardHeader title="Shop" />
          <Select
            value={shopId}
            onChange={e => setShopId(e.target.value)}
            options={shopOptions}
            placeholder="Select a shop..."
          />
        </Card>

        {/* Line items */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardHeader title="Products" />
            <button type="button" onClick={addLine}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-2 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Add line
            </button>
          </div>

          {lineItems.length === 0 && (
            <button type="button" onClick={addLine}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 py-6 text-sm text-gray-400 hover:text-brand-600 transition-colors">
              <Plus className="h-4 w-4" /> Add first product
            </button>
          )}

          <div className="space-y-3">
            {lineItems.map((li, idx) => {
              const avail     = getAvailableStock(li.productId);
              const overStock = li.productId !== "" && li.qty > avail;

              return (
                <div key={idx}
                  className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">

                  {/* Product selector + remove */}
                  <div className="flex items-start gap-2">
                    <TyreSelect
                      value={li.productId}
                      products={products}
                      onChange={id => updateLine(idx, "productId", id)}
                    />
                    <button type="button" onClick={() => removeLine(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Qty + unit price — FIX: use string state for free typing */}
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Qty</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={li.qty === 0 ? "" : li.qty}
                        onChange={e => handleQtyChange(idx, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Unit price (Rs)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        value={li.unitPrice === 0 ? "" : li.unitPrice}
                        onChange={e => handlePriceChange(idx, e.target.value)}
                        onFocus={e => e.target.select()}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                      />
                    </div>
                  </div>

                  {/* Stock + subtotal */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className={overStock ? "font-medium text-red-600" : "text-gray-400"}>
                      Stock: {avail} available
                    </span>
                    <span className="shrink-0 font-medium text-gray-700">
                      Subtotal: {formatLKR(li.qty * li.unitPrice)}
                    </span>
                  </div>

                  {overStock && (
                    <p className="text-xs text-red-600">⚠ Qty exceeds available stock</p>
                  )}
                </div>
              );
            })}
          </div>

          {lineItems.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-500">Total</span>
              <span className="text-xl font-medium text-gray-900">{formatLKR(total)}</span>
            </div>
          )}
        </Card>

        {/* Payment method */}
        <Card>
          <CardHeader title="Payment method" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_OPTS.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => setPaymentType(opt.value)}
                className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  paymentType === opt.value
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}>
                <span className="text-base mb-0.5">{opt.emoji}</span>
                <span className="text-xs font-medium leading-tight">{opt.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Cheque details */}
          {isCheque && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <Input label="Cheque number *" placeholder="e.g. 001234"
                value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
              <Input label="Bank *" placeholder="e.g. Commercial Bank"
                value={bank} onChange={e => setBank(e.target.value)} />

              {/* Due date — auto-filled but editable */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Cheque due date *
                </label>

                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {[15, 30, 45, 60, 90].map(days => {
                    const val = dateStringFromDays(days);
                    return (
                      <button key={days} type="button"
                        onClick={() => setChequeDueDate(val)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          chequeDueDate === val
                            ? "border-brand-400 bg-brand-50 text-brand-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}>
                        {days}d
                      </button>
                    );
                  })}
                </div>

                {/* Editable date input */}
                <input
                  type="date"
                  value={chequeDueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setChequeDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                />

                {/* Display formatted date */}
                {chequeDueDate && (
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <span className="text-sm text-amber-800">Due date</span>
                    <span className="text-sm font-semibold text-amber-900">
                      {new Date(chequeDueDate + "T12:00:00").toLocaleDateString("en-LK", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {isPending && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-800">
                ⏳ This invoice will be added to the shop's outstanding balance. Collect payment later.
              </p>
            </div>
          )}

          {isCard && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-800">
                💳 Card payment — confirm the transaction has been processed on the terminal.
              </p>
            </div>
          )}
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button type="submit" size="lg" loading={saving} className="w-full">
          Confirm invoice · {formatLKR(total)}
        </Button>

      </form>
    </div>
  );
}