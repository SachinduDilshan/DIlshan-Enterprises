"use client";

import { useState } from "react";
import Link from "next/link";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useShops } from "@/hooks/useShops";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { formatLKR } from "@/lib/utils";
import { Store, Plus, ChevronRight, Trash2 } from "lucide-react";
import type { Shop } from "@/types";

export default function ShopsPage() {
  const { shops, loading } = useShops(false);
  const { appUser }        = useAuth();
  const [search, setSearch]       = useState("");
  const [toDelete, setToDelete]   = useState<Shop | null>(null);

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase()) ||
    s.ownerName.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(shop: Shop) {
    await deleteDoc(doc(db, "shops", shop.id));
    setToDelete(null);
  }

  const isAdmin = appUser?.role === "admin";

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Shops</h1>
          <p className="text-sm text-gray-500">{shops.length} registered shops</p>
        </div>
        <Link href="/dashboard/shops/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add shop
          </Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name, city or owner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <Store className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No shops found</p>
          <p className="text-xs text-gray-400 mt-1">Add your first shop to get started</p>
          <Link href="/dashboard/shops/new" className="mt-4">
            <Button size="sm">Add shop</Button>
          </Link>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map(shop => (
          <Card key={shop.id} className="flex items-center gap-3">
            {/* Main info — tappable */}
            <Link href={`/dashboard/shops/${shop.id}`} className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 flex-shrink-0">
                <Store className="h-5 w-5 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{shop.name}</p>
                  {!shop.active && <Badge variant="danger">Inactive</Badge>}
                </div>
                <p className="text-xs text-gray-500 truncate">{shop.ownerName} · {shop.city}</p>
              </div>
              <div className="text-right flex-shrink-0 mr-2">
                {shop.outstandingBalance > 0
                  ? <p className="text-sm font-medium text-red-600">{formatLKR(shop.outstandingBalance)}</p>
                  : <p className="text-sm font-medium text-green-600">Clear</p>
                }
                <p className="text-xs text-gray-400">balance</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
            </Link>

            {/* Delete button — admin only */}
            {isAdmin && (
              <button
                onClick={() => setToDelete(shop)}
                className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                title="Delete shop"
              >
                <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
              </button>
            )}
          </Card>
        ))}
      </div>

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete shop"
          description={`${toDelete.name} — ${toDelete.city}\nOwner: ${toDelete.ownerName}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
