"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ucReturnsCol, stockCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { useProducts } from "@/hooks/useProducts";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import type { Shop, UCReturnReason } from "@/types";

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

export default function NewUCReturnPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { shops }   = useShops();
  const { products } = useProducts();

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [productId, setProductId]       = useState("");
  const [warehouseId, setWarehouseId]   = useState("anuradhapura");
  const [qty, setQty]                   = useState(1);
  const [reason, setReason]             = useState<UCReturnReason>("sidewall_bulge");
  const [reasonNotes, setReasonNotes]   = useState("");
  const [gaveTyre, setGaveTyre]         = useState(true); // almost always true
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  const selectedProduct = products.find(p => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedShop || !productId) {
      setError("Please select a shop and product.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      // If gave new tyre to shop, decrement stock immediately
      if (gaveTyre) {
        const stockDocId = `${warehouseId}_${productId}`;
        await updateDoc(doc(stockCol, stockDocId), {
          qty: increment(-qty),
          updatedAt: serverTimestamp(),
        });
      }

      await addDoc(ucReturnsCol, {
        shopId:               selectedShop.id,
        shopName:             selectedShop.name,
        shopCity:             selectedShop.city,
        productId,
        productName:          selectedProduct?.name ?? "",
        productSku:           selectedProduct?.sku ?? "",
        warehouseId,
        warehouseName:        WAREHOUSES.find(w => w.value === warehouseId)?.label ?? warehouseId,
        qty,
        reason,
        reasonNotes:          reasonNotes || undefined,
        status:               "approved",        // only approved returns are logged
        gaveTyreToShop:       gaveTyre,
        gaveTyreToShopAt:     gaveTyre ? serverTimestamp() : undefined,
        tyreReceivedFromShop: false,             // not yet collected
        createdBy:            appUser?.uid ?? "",
        createdAt:            serverTimestamp(),
        updatedAt:            serverTimestamp(),
        id:                    "",                // will be set to doc ID after creation 
      });

      router.push("/dashboard/uc-returns");
    } catch (err: any) {
      setError(err.message ?? "Failed to save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
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
          Only add returns you have already approved. The system will track the full journey
          from giving a new tyre to the shop, sending to CEAT, and receiving the replacement.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            <Select
              label="Defective tyre *"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              placeholder="Select product..."
              options={products.map(p => ({ value: p.id, label: p.name }))}
            />
            <Select
              label="Your warehouse (where new tyre comes from)"
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              options={WAREHOUSES}
            />
            <div>
              <label className="text-sm font-medium text-gray-700">Quantity</label>
              <input
                type="number" min={1} value={qty}
                onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>
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

        <Card>
          <CardHeader title="Did you give a new tyre to the shop instantly?" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGaveTyre(true)}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                gaveTyre ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"
              }`}
            >
              Yes — gave new tyre
            </button>
            <button
              type="button"
              onClick={() => setGaveTyre(false)}
              className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                !gaveTyre ? "border-red-300 bg-red-50 text-red-800" : "border-gray-200 text-gray-600"
              }`}
            >
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
