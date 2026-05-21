"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc, serverTimestamp, Timestamp, doc, setDoc,
} from "firebase/firestore";
import { dispatchesCol, dispatchStopsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { useShops } from "@/hooks/useShops";
import { useProducts } from "@/hooks/useProducts";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";
import Link from "next/link";
import type { Shop } from "@/types";

const WAREHOUSES = [
  { value: "kurunegala",   label: "Kurunegala"   },
  { value: "anuradhapura", label: "Anuradhapura" },
];

interface StopItem { productId: string; productName: string; qty: number }
interface Stop { shopId: string; shopName: string; shopCity: string; items: StopItem[] }

export default function NewDispatchPage() {
  const router = useRouter();
  const { appUser } = useAuth();
  const { shops }   = useShops();
  const { products } = useProducts();

  const [lorryReg, setLorryReg]         = useState("NB-4512");
  const [lorryModel, setLorryModel]     = useState("Isuzu NPR");
  const [warehouseId, setWarehouseId]   = useState("anuradhapura");
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [stops, setStops]               = useState<Stop[]>([]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  // ── Stop helpers ─────────────────────────────────────────

  function addStop() {
    if (shops.length === 0) return;
    const shop = shops[0];
    setStops(prev => [...prev, {
      shopId: shop.id, shopName: shop.name, shopCity: shop.city,
      items: [{ productId: products[0]?.id ?? "", productName: products[0]?.name ?? "", qty: 1 }],
    }]);
  }

  function removeStop(si: number) {
    setStops(prev => prev.filter((_, i) => i !== si));
  }

  function updateStopShop(si: number, shopId: string) {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    setStops(prev => prev.map((s, i) =>
      i === si ? { ...s, shopId: shop.id, shopName: shop.name, shopCity: shop.city } : s
    ));
  }

  function addItem(si: number) {
    if (products.length === 0) return;
    setStops(prev => prev.map((s, i) =>
      i === si
        ? { ...s, items: [...s.items, { productId: products[0].id, productName: products[0].name, qty: 1 }] }
        : s
    ));
  }

  function updateItem(si: number, ii: number, field: "productId" | "qty", value: string | number) {
    setStops(prev => prev.map((s, i) => {
      if (i !== si) return s;
      return {
        ...s,
        items: s.items.map((item, j) => {
          if (j !== ii) return item;
          if (field === "productId") {
            const p = products.find(p => p.id === value);
            return { ...item, productId: p?.id ?? "", productName: p?.name ?? "" };
          }
          return { ...item, qty: Number(value) };
        }),
      };
    }));
  }

  function removeItem(si: number, ii: number) {
    setStops(prev => prev.map((s, i) =>
      i === si ? { ...s, items: s.items.filter((_, j) => j !== ii) } : s
    ));
  }

  // ── Totals ───────────────────────────────────────────────

  const totalUnits = stops.reduce((sum, s) => sum + s.items.reduce((ss, it) => ss + it.qty, 0), 0);

  // ── Submit ───────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stops.length === 0) return setError("Add at least one delivery stop.");
    for (const s of stops) {
      if (s.items.length === 0) return setError(`Add at least one tyre item for ${s.shopName}.`);
      if (s.items.some(it => !it.productId || it.qty < 1)) return setError("Check all items — product and quantity required.");
    }
    setSaving(true);
    setError("");

    try {
      const wh = WAREHOUSES.find(w => w.value === warehouseId)!;
      const dispatchRef = await addDoc(dispatchesCol, {
        lorryReg,
        lorryModel,
        fromWarehouseId:   warehouseId,
        fromWarehouseName: wh.label,
        createdBy:         appUser?.uid ?? "",
        status:            "planned",
        totalStops:        stops.length,
        totalUnits,
        dispatchDate:      Timestamp.fromDate(new Date(dispatchDate)),
        notes:             "",
        createdAt:         serverTimestamp(),
      });

      // Write each stop as subcollection document
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const stopRef = doc(dispatchStopsCol(dispatchRef.id));
        await setDoc(stopRef, {
          id:          stopRef.id,
          dispatchId:  dispatchRef.id,
          shopId:      s.shopId,
          shopName:    s.shopName,
          shopCity:    s.shopCity,
          stopOrder:   i + 1,
          items:       s.items,
          totalUnits:  s.items.reduce((sum, it) => sum + it.qty, 0),
          status:      "pending",
          deliveredAt: null,
          skippedReason: null,
        });
      }

      router.push(`/dashboard/dispatch/${dispatchRef.id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to create dispatch.");
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-24">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/dispatch">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-medium text-gray-900">Plan dispatch</h1>
          <p className="text-xs text-gray-400">Driver will mark each stop on their phone</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Lorry & date */}
        <Card>
          <CardHeader title="Lorry & date" />
          <div className="space-y-3">
            <Input label="Lorry registration *" value={lorryReg} onChange={e => setLorryReg(e.target.value)} placeholder="e.g. NB-4512" />
            <Input label="Lorry model" value={lorryModel} onChange={e => setLorryModel(e.target.value)} placeholder="e.g. Isuzu NPR" />
            <Select label="From warehouse" value={warehouseId} onChange={e => setWarehouseId(e.target.value)} options={WAREHOUSES} />
            <Input label="Dispatch date" type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} />
          </div>
        </Card>

        {/* Delivery stops */}
        <Card>
          <CardHeader
            title="Delivery stops"
            subtitle={`${stops.length} stops · ${totalUnits} tyres total`}
            action={
              <Button size="sm" variant="secondary" type="button" onClick={addStop}>
                <Plus className="h-4 w-4" /> Add stop
              </Button>
            }
          />

          {stops.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">
              No stops yet — tap "Add stop"
            </div>
          )}

          <div className="space-y-4">
            {stops.map((stop, si) => (
              <div key={si} className="rounded-xl border border-gray-100 p-3">
                {/* Stop header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 flex-shrink-0">
                    {si + 1}
                  </div>
                  <Select
                    value={stop.shopId}
                    onChange={e => updateStopShop(si, e.target.value)}
                    options={shops.map(s => ({ value: s.id, label: `${s.name} — ${s.city}` }))}
                    className="flex-1"
                  />
                  <button type="button" onClick={() => removeStop(si)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Items */}
                <div className="space-y-2 pl-8">
                  {stop.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2">
                      <Select
                        value={item.productId}
                        onChange={e => updateItem(si, ii, "productId", e.target.value)}
                        options={products.map(p => ({ value: p.id, label: p.name }))}
                        className="flex-1"
                      />
                      <input
                        type="number" min={1} value={item.qty}
                        onChange={e => updateItem(si, ii, "qty", parseInt(e.target.value) || 1)}
                        className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-sm text-center focus:outline-none focus:border-brand-400"
                      />
                      <button type="button" onClick={() => removeItem(si, ii)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addItem(si)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    + Add tyre
                  </button>
                </div>

                {/* Stop total */}
                <div className="mt-2 pl-8 text-xs text-gray-400">
                  {stop.items.reduce((s, it) => s + it.qty, 0)} tyres for this stop
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Summary */}
        {stops.length > 0 && (
          <Card className="bg-gray-50 border-0">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total stops</span>
              <span className="font-medium">{stops.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-500">Total tyres on lorry</span>
              <span className="font-medium">{totalUnits}</span>
            </div>
          </Card>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" loading={saving} className="w-full">
          Confirm dispatch plan
        </Button>
      </form>
    </div>
  );
}
