"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  addDoc,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
  increment,
  collection,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { useProducts } from "@/hooks/useProducts";
import { useStock } from "@/hooks/useStock";

import { formatLKR, calcDueDate } from "@/lib/utils";

import {
  invoicesCol,
  chequesCol,
  stockCol,
} from "@/lib/firestore-collections";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader } from "@/components/ui/Card";

import {
  Plus,
  Trash2,
  ArrowLeft,
  ChevronDown,
  Check,
} from "lucide-react";

import Link from "next/link";

import type {
  PaymentType,
  Shop,
  Product,
} from "@/types";


/* =========================================================================
   TYPES
=========================================================================== */

interface LineItem {
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  unitPrice: number;
}

type InvoicePaymentType = PaymentType | "card" | "pending";


/* =========================================================================
   PAYMENT OPTIONS — updated with card and pending
=========================================================================== */

const PAYMENT_OPTS: {
  value: InvoicePaymentType;
  label: string;
  desc: string;
  emoji: string;
}[] = [
    { value: "cash", label: "Cash", desc: "Paid immediately", emoji: "💵" },
    { value: "card", label: "Card payment", desc: "Debit / credit card", emoji: "💳" },
    { value: "cheque_15d", label: "Cheque — 15 days", desc: "Due in 15 days", emoji: "🏦" },
    { value: "cheque_30d", label: "Cheque — 30 days", desc: "Due in 30 days", emoji: "🏦" },
    { value: "cheque_45d", label: "Cheque — 45 days", desc: "Due in 45 days", emoji: "🏦" },
    { value: "cheque_60d", label: "Cheque — 60 days", desc: "Due in 60 days", emoji: "🏦" },
    { value: "pending", label: "Pending / Credit", desc: "Payment to be collected", emoji: "⏳" },
  ];



/* =========================================================================
   GENERATE INVOICE NUMBER
   Format: INV-YYYYMMDD-NNNN  (e.g. INV-20260911-0042)
   Uses Firestore counter doc to keep sequence atomic
=========================================================================== */

async function nextInvoiceNo(): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  const counterRef = doc(db, "counters", "invoices");
  const snap = await getDoc(counterRef);
  const next = (snap.exists() ? snap.data().count : 0) + 1;

  return `INV-${dateStr}-${String(next).padStart(4, "0")}`;
}


/* =========================================================================
   TYRE NAME FONT SIZE
=========================================================================== */

function getTyreNameSize(name: string): string {
  const length = name.trim().length;
  if (length > 55) return "text-[9px]";
  if (length > 42) return "text-[10px]";
  if (length > 30) return "text-[11px]";
  return "text-xs";
}


/* =========================================================================
   CUSTOM TYRE SELECTOR
=========================================================================== */

interface TyreSelectProps {
  value: string;
  products: Product[];
  onChange: (productId: string) => void;
}

function TyreSelect({ value, products, onChange }: TyreSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedProduct = products.find((p) => p.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  function handleSelect(productId: string) {
    onChange(productId);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex min-h-[40px] w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-gray-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={`min-w-0 flex-1 break-words whitespace-normal font-medium leading-4 text-brand-800 ${getTyreNameSize(selectedProduct?.name ?? "")}`}>
          {selectedProduct?.name ?? "Choose a tyre..."}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-64 overflow-y-auto overflow-x-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {products.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No products available</p>
          )}
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={product.id === value}
              onClick={() => handleSelect(product.id)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-brand-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <span className={`block font-medium text-gray-900 ${getTyreNameSize(product.name)}`}>
                  {product.name}
                </span>
                <span className="block text-[10px] text-gray-400 mt-0.5">
                  {product.sku} · Rs {product.unitPrice?.toLocaleString()}
                </span>
              </div>
              {product.id === value && (
                <Check className="h-4 w-4 text-brand-600 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* =========================================================================
   MAIN PAGE
=========================================================================== */

export default function NewInvoicePage() {
  const router = useRouter();
  const { appUser } = useAuth();

  const { shops } = useShops();
  const { products } = useProducts();
  const { stock } = useStock();

  // ── Form state ────────────────────────────────────────
  const [shopId, setShopId] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [paymentType, setPaymentType] = useState<InvoicePaymentType>("cash");
  const [chequeNo, setChequeNo] = useState("");
  const [bank, setBank] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isCheque = paymentType.startsWith("cheque_");
  const isPending = paymentType === "pending";
  const isCard = paymentType === "card";

  // ── Computed values ───────────────────────────────────
  const total = lineItems.reduce(
    (sum, li) => sum + li.qty * li.unitPrice,
    0
  );

  const dueDate = isCheque ? calcDueDate(paymentType as PaymentType) : null;
  const [chequeDueDate, setChequeDueDate] = useState("");

  const selectedShop = shops.find((s) => s.id === shopId) ?? null;

  // ── Load invoice number on mount ──────────────────────
  useEffect(() => {
    nextInvoiceNo().then(setInvoiceNo);
  }, []);


  /* -----------------------------------------------------------------------
     LINE ITEM HELPERS
  ----------------------------------------------------------------------- */

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      { productId: "", productName: "", productSku: "", qty: 1, unitPrice: 0 },
    ]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(
    index: number,
    field: keyof LineItem,
    value: string | number
  ) {
    setLineItems((prev) =>
      prev.map((li, i) => {
        if (i !== index) return li;
        if (field === "productId" && typeof value === "string") {
          const product = products.find((p) => p.id === value);
          return {
            ...li,
            productId: value,
            productName: product?.name ?? "",
            productSku: product?.sku ?? "",
            unitPrice: product?.unitPrice ?? 0,
          };
        }
        return { ...li, [field]: value };
      })
    );
  }

  function getAvailableStock(productId: string): number {
    const stockItem = stock.find((s) => s.productId === productId);
    return stockItem?.qty ?? 0;
  }


  /* -----------------------------------------------------------------------
     SUBMIT
  ----------------------------------------------------------------------- */

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (!shopId) {
      setError("Please select a shop."); return;
    }
    if (lineItems.length === 0) {
      setError("Add at least one product."); return;
    }
    const emptyLine = lineItems.find((li) => !li.productId);
    if (emptyLine) {
      setError("Please select a product for each line item."); return;
    }
    // cheque validation:
    if (isCheque && (!chequeNo.trim() || !bank.trim())) {
      setError("Please enter the cheque number and bank name."); return;
    }
    if (isCheque && !chequeDueDate) {
      setError("Please select a cheque due date."); return;
    }
    const overStockItem = lineItems.find(
      (li) => li.qty > getAvailableStock(li.productId)
    );
    if (overStockItem) {
      setError(`Not enough stock for ${overStockItem.productName}.`); return;
    }

    setSaving(true);

    try {
      // 1. Increment counter atomically
      const counterRef = doc(db, "counters", "invoices");
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const next = (snap.exists() ? snap.data().count : 0) + 1;
        tx.set(counterRef, { count: next }, { merge: true });
      });

      // 2. Create invoice
      const invoiceData = {
        invoiceNo,
        shopId,
        shopName: selectedShop?.name ?? "",
        items: lineItems.map((li) => ({
          productId: li.productId,
          productName: li.productName,
          productSku: li.productSku,
          qty: li.qty,
          unitPrice: li.unitPrice,
          total: li.qty * li.unitPrice,
        })),
        totalAmount: total,
        paymentType: paymentType as PaymentType,
        status: "confirmed",
        invoiceDate: serverTimestamp(),
        createdBy: appUser?.uid ?? "",
        createdAt: serverTimestamp(),
      } as any;

      const invoiceRef = await addDoc(invoicesCol, invoiceData);

      // 3. Deduct stock for each line item
      for (const li of lineItems) {
        await runTransaction(db, async (tx) => {
          const stockRef = doc(stockCol, `${li.productId}`);
          const stockSnap = await tx.get(stockRef);
          if (stockSnap.exists()) {
            const current = stockSnap.data().qty ?? 0;
            tx.update(stockRef, {
              qty: Math.max(0, current - li.qty),
              updatedAt: serverTimestamp(),
            });
          }
        });
      }

      // 4. Create cheque record if cheque payment
      if (isCheque && chequeDueDate) {
        const due = new Date(chequeDueDate);
        due.setHours(23, 59, 59, 999);

        const chequeRef = doc(chequesCol);
        await setDoc(chequeRef, {
          id: chequeRef.id,
          shopId,
          shopName: selectedShop?.name ?? "",
          invoiceId: invoiceRef.id,
          invoiceNo,
          chequeNo: chequeNo.trim(),
          bank: bank.trim(),
          amount: total,
          dueDate: Timestamp.fromDate(due),
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 5. For pending — add to shop outstanding balance
      if (isPending) {
        try {
          await runTransaction(db, async (tx) => {
            const shopRef = doc(db, "shops", shopId);
            const shopSnap = await tx.get(shopRef);
            if (shopSnap.exists()) {
              tx.update(shopRef, {
                outstandingBalance: increment(total),
                updatedAt: serverTimestamp(),
              });
            }
          });
        } catch { }
      }

      router.push(`/dashboard/invoices/${invoiceRef.id}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }


  /* -----------------------------------------------------------------------
     RENDER
  ----------------------------------------------------------------------- */

  const shopOptions = [
    { value: "", label: "Select a shop..." },
    ...shops.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-20 md:p-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50"
          >
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

        {/* ── Shop ── */}
        <Card>
          <CardHeader title="Shop" />
          <Select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            options={shopOptions}
            placeholder="Select a shop..."
          />
        </Card>


        {/* ── Line items ── */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardHeader title="Products" />
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-3 py-2 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </button>
          </div>

          {lineItems.length === 0 && (
            <button
              type="button"
              onClick={addLine}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 py-6 text-sm text-gray-400 hover:text-brand-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add first product
            </button>
          )}

          <div className="space-y-3">
            {lineItems.map((li, idx) => {
              const avail = getAvailableStock(li.productId);
              const overStock = li.productId !== "" && li.qty > avail;

              return (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  {/* Product selector + remove */}
                  <div className="flex items-start gap-2">
                    <TyreSelect
                      value={li.productId}
                      products={products}
                      onChange={(id) => updateLine(idx, "productId", id)}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Qty + unit price */}
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <label className="text-xs text-gray-500">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={li.qty}
                        onChange={(e) =>
                          updateLine(idx, "qty", Math.max(1, parseInt(e.target.value) || 1))
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="text-xs text-gray-500">Unit price (Rs)</label>
                      <input
                        type="number"
                        min={1}
                        value={li.unitPrice}
                        onChange={(e) =>
                          updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
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
                    <p className="text-xs text-red-600">
                      ⚠ Qty exceeds available stock
                    </p>
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


        {/* ── Payment method ── */}
        <Card>
          <CardHeader title="Payment method" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentType(opt.value)}
                className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${paymentType === opt.value
                  ? "border-brand-400 bg-brand-50 text-brand-800"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                  }`}
              >
                <span className="text-base mb-0.5">{opt.emoji}</span>
                <span className="text-xs font-medium leading-tight">{opt.label}</span>
                <span className="text-[10px] text-gray-400 mt-0.5 leading-tight">{opt.desc}</span>
              </button>
            ))}
          </div>

          {/* Cheque details */}
          {isCheque && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <Input
                label="Cheque number *"
                placeholder="e.g. 001234"
                value={chequeNo}
                onChange={(e) => setChequeNo(e.target.value)}
              />
              <Input
                label="Bank *"
                placeholder="e.g. Commercial Bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
              {/* Custom due date picker */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Cheque due date *
                </label>
                <input
                  type="date"
                  value={chequeDueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => setChequeDueDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
                />
                {/* Quick presets */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: "15 days", days: 15 },
                    { label: "30 days", days: 30 },
                    { label: "45 days", days: 45 },
                    { label: "60 days", days: 60 },
                    { label: "90 days", days: 90 },
                  ].map(opt => {
                    const d = new Date();
                    d.setDate(d.getDate() + opt.days);
                    const val = d.toISOString().split("T")[0];
                    return (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setChequeDueDate(val)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${chequeDueDate === val
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {chequeDueDate && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <span className="text-sm text-amber-800">Due date</span>
                  <span className="text-sm font-semibold text-amber-900">
                    {new Date(chequeDueDate).toLocaleDateString("en-LK", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Pending notice */}
          {isPending && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-xs text-amber-800">
                ⏳ This invoice will be added to the shop's outstanding balance. Collect payment later.
              </p>
            </div>
          )}

          {/* Card notice */}
          {isCard && (
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-xs text-blue-800">
                💳 Card payment — confirm the transaction has been processed on the terminal.
              </p>
            </div>
          )}
        </Card>


        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}


        {/* ── Submit ── */}
        <Button
          type="submit"
          size="lg"
          loading={saving}
          className="w-full"
        >
          Confirm invoice · {formatLKR(total)}
        </Button>

      </form>
    </div>
  );
}