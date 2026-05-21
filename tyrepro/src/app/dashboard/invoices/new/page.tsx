"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, doc, runTransaction, serverTimestamp,
  Timestamp, getDoc, increment, collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { useProducts } from "@/hooks/useProducts";
import { useStock } from "@/hooks/useStock";
import { formatLKR, calcDueDate } from "@/lib/utils";
import { invoicesCol, invoiceItemsCol, chequesCol, stockCol } from "@/lib/firestore-collections";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PaymentType, Shop, Product } from "@/types";

interface LineItem {
  productId:   string;
  productName: string;
  productSku:  string;
  qty:         number;
  unitPrice:   number;
}

const PAYMENT_OPTS: { value: PaymentType; label: string }[] = [
  { value: "cash",        label: "Cash"           },
  { value: "cheque_15d",  label: "Cheque — 15 days" },
  { value: "cheque_30d",  label: "Cheque — 30 days" },
  { value: "cheque_45d",  label: "Cheque — 45 days" },
  { value: "cheque_60d",  label: "Cheque — 60 days" },
];

// Generate invoice number client-side (server should do this atomically in prod)
async function nextInvoiceNo(): Promise<string> {
  const snap = await getDoc(doc(db, "counters", "invoices"));
  const next = (snap.exists() ? snap.data().count : 0) + 1;
  return `INV-${String(next).padStart(4, "0")}`;
}

export default function NewInvoicePage() {
  const router      = useRouter();
  const { appUser } = useAuth();
  const { shops }   = useShops();
  const { products } = useProducts();

  const [selectedShop, setSelectedShop]     = useState<Shop | null>(null);
  const [paymentType, setPaymentType]       = useState<PaymentType>("cash");
  const [chequeNo, setChequeNo]             = useState("");
  const [bank, setBank]                     = useState("");
  const [lineItems, setLineItems]           = useState<LineItem[]>([]);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState("");

  const { stock } = useStock({ warehouseId: selectedShop?.assignedWarehouseId });

  const total = lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0);
  const isCheque = paymentType !== "cash";

  const dueDate = isCheque
    ? calcDueDate(new Date(), paymentType)
    : null;

  // Add a blank line item
  function addLine() {
    if (products.length === 0) return;
    const p = products[0];
    setLineItems(prev => [...prev, {
      productId:   p.id,
      productName: p.name,
      productSku:  p.sku,
      qty:         1,
      unitPrice:   p.unitPrice,
    }]);
  }

  function updateLine(idx: number, field: keyof LineItem, value: string | number) {
    setLineItems(prev => {
      const next = [...prev];
      if (field === "productId") {
        const p = products.find(p => p.id === value);
        if (p) next[idx] = { ...next[idx], productId: p.id, productName: p.name, productSku: p.sku, unitPrice: p.unitPrice };
      } else {
        (next[idx] as any)[field] = value;
      }
      return next;
    });
  }

  function removeLine(idx: number) {
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  }

  function stockQty(productId: string): number {
    return stock.find(s => s.productId === productId)?.qty ?? 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedShop) return setError("Please select a shop.");
    if (lineItems.length === 0) return setError("Add at least one tyre item.");
    if (isCheque && (!chequeNo || !bank)) return setError("Enter cheque number and bank.");

    // Validate stock
    for (const li of lineItems) {
      const avail = stockQty(li.productId);
      if (li.qty > avail) {
        return setError(`Insufficient stock for ${li.productName}. Available: ${avail}`);
      }
    }

    setSaving(true);
    try {
      const invoiceNo = await nextInvoiceNo();
      const invoiceDate = Timestamp.now();

      await runTransaction(db, async (tx) => {
        // 1. Decrement stock for each line item
        for (const li of lineItems) {
          const stockDocId = `${selectedShop.assignedWarehouseId}_${li.productId}`;
          const stockRef   = doc(stockCol, stockDocId);
          tx.update(stockRef, { qty: increment(-li.qty), updatedAt: serverTimestamp() });
        }

        // 2. Increment counter
        const counterRef = doc(db, "counters", "invoices");
        tx.set(counterRef, { count: increment(1) }, { merge: true });

        // 3. Create invoice doc
        const invRef = doc(invoicesCol);
        tx.set(invRef, {
          invoiceNo,
          shopId:        selectedShop.id,
          shopName:      selectedShop.name,
          warehouseId:   selectedShop.assignedWarehouseId,
          warehouseName: selectedShop.assignedWarehouseId === "kurunegala" ? "Kurunegala" : "Anuradhapura",
          createdBy:     appUser!.uid,
          paymentType,
          totalAmount:   total,
          status:        "confirmed",
          invoiceDate,
          createdAt:     serverTimestamp(),
          updatedAt:     serverTimestamp(),
        });

        // 4. Create invoice items in subcollection (outside transaction — subcollections don't support tx.set in all SDK versions)
        // We'll do this after the transaction

        // 5. Update shop outstanding balance
        const shopRef = doc(db, "shops", selectedShop.id);
        tx.update(shopRef, {
          outstandingBalance: increment(isCheque ? total : 0),
          updatedAt: serverTimestamp(),
        });

        // 6. Create cheque doc if not cash
        if (isCheque && dueDate) {
          const chequeRef = doc(chequesCol);
          tx.set(chequeRef, {
            invoiceId:   invRef.id,
            invoiceNo,
            shopId:      selectedShop.id,
            shopName:    selectedShop.name,
            chequeNo,
            bank,
            amount:      total,
            dueDate:     Timestamp.fromDate(dueDate),
            status:      "pending",
            createdAt:   serverTimestamp(),
            updatedAt:   serverTimestamp(),
          });
        }

        return invRef.id;
      });

      // Write line items (outside transaction is fine — they're immutable after creation)
      // We need the invoice ID — re-query the latest invoice by invoiceNo
      const { getDocs: gd, query: q, where: wh, orderBy: ob, limit: lim } = await import("firebase/firestore");
      const snap = await gd(q(invoicesCol, wh("invoiceNo", "==", invoiceNo)));
      if (!snap.empty) {
        const invId  = snap.docs[0].id;
        const itemsCol = invoiceItemsCol(invId);
        for (const li of lineItems) {
          await addDoc(itemsCol, {
            invoiceId:   invId,
            productId:   li.productId,
            productName: li.productName,
            productSku:  li.productSku,
            qty:         li.qty,
            unitPrice:   li.unitPrice,
            lineTotal:   li.qty * li.unitPrice,
          });
        }
      }

      router.push("/dashboard/invoices");
    } catch (err: any) {
      setError(err.message ?? "Failed to create invoice.");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-24">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-medium text-gray-900">New invoice</h1>
          <p className="text-xs text-gray-400">Auto-assigned number on save</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shop selection */}
        <Card>
          <CardHeader title="Shop" />
          <Select
            label="Select shop *"
            value={selectedShop?.id ?? ""}
            onChange={e => setSelectedShop(shops.find(s => s.id === e.target.value) ?? null)}
            placeholder="Choose a shop..."
            options={shops.map(s => ({ value: s.id, label: `${s.name} — ${s.city}` }))}
          />
          {selectedShop && (
            <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Owner</span><span className="font-medium">{selectedShop.ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span>Warehouse</span><span className="font-medium capitalize">{selectedShop.assignedWarehouseId}</span>
              </div>
              {selectedShop.outstandingBalance > 0 && (
                <div className="flex justify-between">
                  <span>Outstanding</span>
                  <span className="font-medium text-red-600">{formatLKR(selectedShop.outstandingBalance)}</span>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Line items */}
        <Card>
          <CardHeader
            title="Tyre items"
            action={
              <Button size="sm" variant="secondary" type="button" onClick={addLine}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            }
          />

          {lineItems.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              No items yet — tap "Add" to begin
            </div>
          )}

          <div className="space-y-3">
            {lineItems.map((li, idx) => {
              const avail = stockQty(li.productId);
              const overStock = li.qty > avail;
              return (
                <div key={idx} className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Select
                      value={li.productId}
                      onChange={e => updateLine(idx, "productId", e.target.value)}
                      options={products.map(p => ({ value: p.id, label: p.name }))}
                      className="flex-1"
                    />
                    <button type="button" onClick={() => removeLine(idx)} className="ml-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Qty</label>
                      <input
                        type="number" min={1} max={avail}
                        value={li.qty}
                        onChange={e => updateLine(idx, "qty", Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Unit price (Rs)</label>
                      <input
                        type="number" min={1}
                        value={li.unitPrice}
                        onChange={e => updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={overStock ? "text-red-600 font-medium" : "text-gray-400"}>
                      Stock: {avail} available
                    </span>
                    <span className="font-medium text-gray-700">
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

        {/* Payment */}
        <Card>
          <CardHeader title="Payment method" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAYMENT_OPTS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentType(opt.value)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  paymentType === opt.value
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isCheque && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              <Input label="Cheque number *" placeholder="e.g. 001234" value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
              <Input label="Bank *" placeholder="e.g. Commercial Bank" value={bank} onChange={e => setBank(e.target.value)} />
              {dueDate && (
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                  <span className="text-sm text-amber-800">Due date</span>
                  <span className="text-sm font-medium text-amber-900">
                    {dueDate.toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

        <Button type="submit" size="lg" loading={saving} className="w-full">
          Confirm invoice · {formatLKR(total)}
        </Button>
      </form>
    </div>
  );
}
