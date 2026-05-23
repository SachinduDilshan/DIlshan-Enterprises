"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, serverTimestamp, collection,
  query, where, getDocs, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ucReturnsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ArrowLeft, Info, Package } from "lucide-react";
import Link from "next/link";
import type { Shop, UCReturnReason } from "@/types";

const REASONS: { value: UCReturnReason; label: string }[] = [
  { value: "sidewall_bulge",       label: "Sidewall bulge"        },
  { value: "tread_separation",     label: "Tread separation"      },
  { value: "manufacturing_defect", label: "Manufacturing defect"  },
  { value: "bead_damage",          label: "Bead damage"           },
  { value: "other",                label: "Other"                 },
];

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SoldProduct {
  productId:   string;
  productName: string;
  productSku:  string;
  unitPrice:   number;
}

export default function NewUCReturnPage() {
  const router      = useRouter();
  const { appUser } = useAuth();
  const { shops }   = useShops();

  const [selectedShop, setSelectedShop]     = useState<Shop | null>(null);
  const [soldProducts, setSoldProducts]     = useState<SoldProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [productId, setProductId]     = useState("");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku]   = useState("");
  const [unitPrice, setUnitPrice]     = useState(0);

  const [qty, setQty]                 = useState(1);
  const [reason, setReason]           = useState<UCReturnReason>("sidewall_bulge");
  const [reasonNotes, setReasonNotes] = useState("");

  const [returnReceivedAt, setReturnReceivedAt] = useState(toDatetimeLocal(new Date()));
  const [gaveTyreToShop, setGaveTyreToShop]     = useState(true);
  const [gaveTyreAt, setGaveTyreAt]             = useState(toDatetimeLocal(new Date()));

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  // Load products previously sold to selected shop
  useEffect(() => {
    if (!selectedShop) { setSoldProducts([]); return; }
    setProductsLoading(true);
    setProductId(""); setProductName(""); setProductSku(""); setUnitPrice(0);

    async function load() {
      try {
        const invSnap = await getDocs(
          query(
            collection(db, "invoices"),
            where("shopId", "==", selectedShop!.id),
            where("status", "==", "confirmed")
          )
        );
        const map: Record<string, SoldProduct> = {};
        for (const invDoc of invSnap.docs) {
          const itemsSnap = await getDocs(collection(db, "invoices", invDoc.id, "items"));
          itemsSnap.docs.forEach(d => {
            const item = d.data();
            if (item.productId && !map[item.productId]) {
              map[item.productId] = {
                productId:   item.productId,
                productName: item.productName,
                productSku:  item.productSku,
                unitPrice:   item.unitPrice,
              };
            }
          });
        }
        setSoldProducts(Object.values(map));
      } catch { setSoldProducts([]); }
      finally { setProductsLoading(false); }
    }
    load();
  }, [selectedShop?.id]);

  function handleProductChange(pid: string) {
    setProductId(pid);
    const found = soldProducts.find(p => p.productId === pid);
    if (found) {
      setProductName(found.productName);
      setProductSku(found.productSku);
      setUnitPrice(found.unitPrice);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop)  return setError("Please select a shop.");
    if (!productId)     return setError("Please select the defective tyre.");

    setSaving(true); setError("");
    try {
      // NO stock changes — UC tyres are completely separate from inventory
      await addDoc(ucReturnsCol, {
        shopId:               selectedShop.id,
        shopName:             selectedShop.name,
        shopCity:             selectedShop.city,
        productId,
        productName,
        productSku,
        unitPrice,
        qty,
        totalValue:           unitPrice * qty,
        reason,
        reasonNotes:          reasonNotes || undefined,
        status:               "approved",
        gaveTyreToShop,
        gaveTyreToShopAt:     gaveTyreToShop
          ? Timestamp.fromDate(new Date(gaveTyreAt))
          : undefined,
        tyreReceivedFromShop: true,
        tyreReceivedAt:       Timestamp.fromDate(new Date(returnReceivedAt)),
        sentToSupplierAt:     undefined,
        replacementReceivedAt: undefined,
        createdBy:            appUser?.uid ?? "",
        createdAt:            serverTimestamp(),
        updatedAt:            serverTimestamp(),
      } as any);
      router.push("/dashboard/uc-returns");
    } catch (err: any) {
      setError(err.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-16">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/uc-returns">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-medium text-gray-900">Add UC return</h1>
          <p className="text-xs text-gray-400">Log a defective tyre returned from a shop</p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800">
          UC tyres are tracked separately from your warehouse inventory.
          No stock will be changed when you log a UC return.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Shop & product */}
        <Card>
          <CardHeader title="Return details" />
          <div className="space-y-3">
            <Select
              label="Shop *"
              value={selectedShop?.id ?? ""}
              onChange={e => setSelectedShop(shops.find(s => s.id === e.target.value) ?? null)}
              placeholder="Select shop..."
              options={shops.map(s => ({ value: s.id, label: `${s.name} — ${s.city}` }))}
            />

            {selectedShop && (
              <>
                {productsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    Loading products sold to this shop...
                  </div>
                ) : soldProducts.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                    <Package className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">No invoices found for this shop yet.</p>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Defective tyre * <span className="text-xs font-normal text-gray-400">(from this shop's purchase history)</span>
                    </label>
                    <select
                      value={productId}
                      onChange={e => handleProductChange(e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">Select tyre...</option>
                      {soldProducts.map(p => (
                        <option key={p.productId} value={p.productId}>{p.productName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {productId && (
              <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600 space-y-1">
                <div className="flex justify-between"><span>SKU</span><span className="font-medium">{productSku}</span></div>
                <div className="flex justify-between"><span>Unit price</span><span className="font-medium">Rs {unitPrice.toLocaleString()}</span></div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity returned</label>
              <input type="number" min={1} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>

            {productId && qty > 0 && (
              <div className="flex justify-between rounded-xl bg-brand-50 px-3 py-2.5 text-sm">
                <span className="text-gray-600">Total return value</span>
                <span className="font-semibold text-brand-800">Rs {(unitPrice * qty).toLocaleString()}</span>
              </div>
            )}

            <Select
              label="Reason for return *"
              value={reason}
              onChange={e => setReason(e.target.value as UCReturnReason)}
              options={REASONS}
            />
            <Input
              label="Additional notes"
              placeholder="Any extra details about the defect..."
              value={reasonNotes}
              onChange={e => setReasonNotes(e.target.value)}
            />
          </div>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader title="Dates & times" />
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Date & time we received the defective tyre *
              </label>
              <input type="datetime-local" value={returnReceivedAt}
                onChange={e => setReturnReceivedAt(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Did you give a replacement tyre to the shop?
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGaveTyreToShop(true)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    gaveTyreToShop ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"
                  }`}>
                  Yes — gave replacement
                </button>
                <button type="button" onClick={() => setGaveTyreToShop(false)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    !gaveTyreToShop ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"
                  }`}>
                  Not yet
                </button>
              </div>
            </div>

            {gaveTyreToShop && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Date & time replacement was given
                </label>
                <input type="datetime-local" value={gaveTyreAt}
                  onChange={e => setGaveTyreAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
                />
              </div>
            )}
          </div>
        </Card>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Button type="submit" size="lg" loading={saving} className="w-full">
          Save UC return
        </Button>
      </form>
    </div>
  );
}
