"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, serverTimestamp, doc, updateDoc,
  increment, collection, query, where,
  getDocs, orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ucReturnsCol, stockCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ArrowLeft, Info, Package } from "lucide-react";
import Link from "next/link";
import type { Shop, UCReturnReason, Product } from "@/types";

const WAREHOUSES = [
  { value: "kurunegala",   label: "Kurunegala"   },
  { value: "anuradhapura", label: "Anuradhapura" },
];

const REASONS: { value: UCReturnReason; label: string }[] = [
  { value: "sidewall_bulge",       label: "Sidewall bulge"        },
  { value: "tread_separation",     label: "Tread separation"      },
  { value: "manufacturing_defect", label: "Manufacturing defect"  },
  { value: "bead_damage",          label: "Bead damage"           },
  { value: "other",                label: "Other"                 },
];

// Format a Date to datetime-local input value
function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewUCReturnPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { shops }   = useShops();

  const [selectedShop, setSelectedShop]   = useState<Shop | null>(null);
  const [warehouseId, setWarehouseId]     = useState("anuradhapura");

  // Products sold to this shop from invoice history
  const [shopProducts, setShopProducts]   = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [productId, setProductId]         = useState("");
  const [productName, setProductName]     = useState("");
  const [productSku, setProductSku]       = useState("");

  const [qty, setQty]                     = useState(1);
  const [reason, setReason]               = useState<UCReturnReason>("sidewall_bulge");
  const [reasonNotes, setReasonNotes]     = useState("");
  const [gaveTyre, setGaveTyre]           = useState(true);

  // Date/time inputs
  const [returnReceivedAt, setReturnReceivedAt] = useState(toDatetimeLocal(new Date()));
  const [gaveTyreAt, setGaveTyreAt]             = useState(toDatetimeLocal(new Date()));

  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // When shop changes, load products sold to that shop from invoice history
  useEffect(() => {
    if (!selectedShop) { setShopProducts([]); return; }
    setProductsLoading(true);
    setProductId(""); setProductName(""); setProductSku("");

    async function loadShopProducts() {
      try {
        // Get all invoice items for this shop
        const invSnap = await getDocs(
          query(
            collection(db, "invoices"),
            where("shopId", "==", selectedShop!.id),
            where("status", "==", "confirmed")
          )
        );

        const productMap: Record<string, Product> = {};
        for (const invDoc of invSnap.docs) {
          const itemsSnap = await getDocs(
            collection(db, "invoices", invDoc.id, "items")
          );
          itemsSnap.docs.forEach(d => {
            const item = d.data();
            if (item.productId && !productMap[item.productId]) {
              productMap[item.productId] = {
                id:        item.productId,
                name:      item.productName,
                sku:       item.productSku,
                brand:     "",
                type:      "bike",
                size:      "",
                unitPrice: item.unitPrice,
                active:    true,
                createdAt: Timestamp.now(),
              };
            }
          });
        }
        setShopProducts(Object.values(productMap));
      } catch (e) {
        setShopProducts([]);
      } finally {
        setProductsLoading(false);
      }
    }
    loadShopProducts();
  }, [selectedShop?.id]);

  function handleProductChange(pid: string) {
    setProductId(pid);
    const found = shopProducts.find(p => p.id === pid);
    if (found) {
      setProductName(found.name);
      setProductSku(found.sku);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop)  return setError("Please select a shop.");
    if (!productId)     return setError("Please select the defective tyre.");
    if (!productName)   return setError("Product not found — please select again.");

    setSaving(true);
    setError("");

    try {
      // Decrement stock if gave new tyre
      if (gaveTyre) {
        const stockDocId = `${warehouseId}_${productId}`;
        await updateDoc(doc(stockCol, stockDocId), {
          qty:       increment(-qty),
          updatedAt: serverTimestamp(),
        });
      }

      await addDoc(ucReturnsCol, {
        shopId:               selectedShop.id,
        shopName:             selectedShop.name,
        shopCity:             selectedShop.city,
        productId,
        productName,
        productSku,
        warehouseId,
        warehouseName:        WAREHOUSES.find(w => w.value === warehouseId)?.label ?? warehouseId,
        qty,
        reason,
        reasonNotes:          reasonNotes || null,
        status:               "approved",
        gaveTyreToShop:       gaveTyre,
        gaveTyreToShopAt:     gaveTyre
          ? Timestamp.fromDate(new Date(gaveTyreAt))
          : null,
        tyreReceivedFromShop: true,   // we always receive the tyre when logging
        tyreReceivedAt:       Timestamp.fromDate(new Date(returnReceivedAt)),
        sentToSupplierAt:     null,
        replacementReceivedAt: null,
        createdBy:            appUser?.uid ?? "",
        createdAt:            serverTimestamp(),
        updatedAt:            serverTimestamp(),
      });

      router.push("/dashboard/uc-returns");
    } catch (err: any) {
      setError(err.message ?? "Failed to save. Please try again.");
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
          <p className="text-xs text-gray-400">Only log approved defective tyres</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800">
          Only add returns you have already approved. Products shown are only those
          previously sold to the selected shop.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shop + product */}
        <Card>
          <CardHeader title="Return details" />
          <div className="space-y-3">

            {/* Shop */}
            <Select
              label="Shop *"
              value={selectedShop?.id ?? ""}
              onChange={e => setSelectedShop(shops.find(s => s.id === e.target.value) ?? null)}
              placeholder="Select shop..."
              options={shops.map(s => ({ value: s.id, label: `${s.name} — ${s.city}` }))}
            />

            {/* Defective tyre — only from shop's purchase history */}
            {selectedShop && (
              <>
                {productsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                    Loading products sold to this shop...
                  </div>
                ) : shopProducts.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                    <Package className="h-4 w-4 flex-shrink-0" />
                    No invoices found for this shop. Create an invoice first.
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Defective tyre * <span className="text-xs font-normal text-gray-400">(products sold to this shop)</span>
                    </label>
                    <select
                      value={productId}
                      onChange={e => handleProductChange(e.target.value)}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    >
                      <option value="">Select product...</option>
                      {shopProducts.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            {/* Warehouse */}
            <Select
              label="Your warehouse (where new tyre comes from)"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              options={WAREHOUSES}
            />

            {/* Quantity */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
              <input
                type="number" min={1} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>

            {/* Reason */}
            <Select
              label="Reason for return *"
              value={reason}
              onChange={e => setReason(e.target.value as UCReturnReason)}
              options={REASONS}
            />
            <Input
              label="Additional notes"
              placeholder="Any extra details..."
              value={reasonNotes}
              onChange={e => setReasonNotes(e.target.value)}
            />
          </div>
        </Card>

        {/* Dates & times */}
        <Card>
          <CardHeader title="Dates & times" />
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Date & time we received the defective tyre *
              </label>
              <input
                type="datetime-local"
                value={returnReceivedAt}
                onChange={e => setReturnReceivedAt(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>

            {gaveTyre && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Date & time we gave new tyre to shop *
                </label>
                <input
                  type="datetime-local"
                  value={gaveTyreAt}
                  onChange={e => setGaveTyreAt(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
                />
              </div>
            )}
          </div>
        </Card>

        {/* Did you give a new tyre */}
        <Card>
          <CardHeader title="Did you give a new tyre to the shop instantly?" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setGaveTyre(true)}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                gaveTyre ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"
              }`}>
              Yes — gave new tyre
            </button>
            <button type="button" onClick={() => setGaveTyre(false)}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                !gaveTyre ? "border-red-300 bg-red-50 text-red-800" : "border-gray-200 text-gray-600"
              }`}>
              No — not yet
            </button>
          </div>
          {gaveTyre && (
            <p className="mt-2 text-xs text-gray-500">
              Stock will be decremented by {qty} from {WAREHOUSES.find(w => w.value === warehouseId)?.label} warehouse.
            </p>
          )}
        </Card>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" loading={saving} className="w-full">
          Save UC return
        </Button>
      </form>
    </div>
  );
}
