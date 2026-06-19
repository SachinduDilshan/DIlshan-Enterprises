"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, serverTimestamp } from "firebase/firestore";
import { shopsCol } from "@/lib/firestore-collections";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const WAREHOUSES = [
  { value: "polonnaruwa",   label: "Polonnaruwa"   },
  { value: "anuradhapura", label: "Anuradhapura" },
];

export default function NewShopPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const [form, setForm] = useState({
    name: "", ownerName: "", phone: "",
    address: "", city: "",
    assignedWarehouseId: "anuradhapura",
  });

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.ownerName || !form.phone || !form.city) {
      setError("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await addDoc(shopsCol, {
        ...form,
        district:           "Anuradhapura",
        outstandingBalance: 0,
        active:             true,
        createdAt:          serverTimestamp(),
        updatedAt:          serverTimestamp(),
        id:                 "", // will be set in Firestore trigger
      });
      router.push("/dashboard/shops");
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/shops">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <h1 className="text-xl font-medium text-gray-900">Add new shop</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader title="Shop details" />
          <div className="space-y-3">
            <Input label="Shop name *" placeholder="e.g. Perera Tyres" value={form.name} onChange={e => set("name", e.target.value)} required />
            <Input label="Owner name *" placeholder="e.g. Kamal Perera" value={form.ownerName} onChange={e => set("ownerName", e.target.value)} required />
            <Input label="Phone *" type="tel" placeholder="07X XXXXXXX" value={form.phone} onChange={e => set("phone", e.target.value)} required />
            <Input label="City *" placeholder="e.g. Medawachchiya" value={form.city} onChange={e => set("city", e.target.value)} required />
            <Input label="Address" placeholder="Street / area (optional)" value={form.address} onChange={e => set("address", e.target.value)} />
            <Select
              label="Served by warehouse"
              value={form.assignedWarehouseId}
              onChange={e => set("assignedWarehouseId", e.target.value)}
              options={WAREHOUSES}
            />
          </div>

          {error && <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="mt-4 flex gap-3">
            <Link href="/dashboard/shops" className="flex-1">
              <Button variant="secondary" className="w-full" type="button">Cancel</Button>
            </Link>
            <Button className="flex-1" type="submit" loading={saving}>Save shop</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
