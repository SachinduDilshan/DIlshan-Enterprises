"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { deleteDoc, doc } from "firebase/firestore";
import { ChevronRight, Plus, Search, Store, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useShops } from "@/hooks/useShops";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatStrip } from "@/components/ui/StatStrip";
import type { StatItem } from "@/components/ui/StatStrip";
import { cn, formatLKR } from "@/lib/utils";
import type { Shop } from "@/types";

type Filter = "all" | "balance";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function ShopsPage() {
  const { shops, loading } = useShops(false);
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toDelete, setToDelete] = useState<Shop | null>(null);

  /* ---------------- derived ---------------- */

  const stats = useMemo(() => {
    let outstanding = 0;
    let owing = 0;
    for (const s of shops) {
      const balance = Number(s.outstandingBalance) || 0;
      if (balance > 0) {
        owing += 1;
        outstanding += balance;
      }
    }
    return { total: shops.length, owing, clear: shops.length - owing, outstanding };
  }, [shops]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shops
      .filter(s => {
        if (filter === "balance" && !(Number(s.outstandingBalance) > 0)) return false;
        if (!q) return true;
        return (
          s.name?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.ownerName?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (Number(b.outstandingBalance) || 0) - (Number(a.outstandingBalance) || 0));
  }, [shops, search, filter]);

  const kpis: StatItem[] = [
    { label: "Registered shops", value: String(stats.total) },
    { label: "Owe a balance", value: String(stats.owing), hint: "Shops with money outstanding" },
    { label: "Total outstanding", value: formatLKR(stats.outstanding) },
    { label: "Accounts clear", value: String(stats.clear), hint: "No balance due" },
  ];

  async function handleDelete(shop: Shop) {
    await deleteDoc(doc(db, "shops", shop.id));
    setToDelete(null);
  }

  const addShop = (
    <Link
      href="/dashboard/shops/new"
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:h-10"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add shop
    </Link>
  );

  const hasFilters = search.trim() !== "" || filter !== "all";

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Shops"
        description="Customer accounts and what each shop owes"
        actions={addShop}
      />

      <StatStrip items={kpis} loading={loading} className="mb-6" />

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, owner or city"
            aria-label="Search shops"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:h-10"
          />
        </div>

        <div className="flex gap-2" role="group" aria-label="Filter shops">
          {([
            { key: "all", label: "All shops", count: shops.length },
            { key: "balance", label: "Owe a balance", count: stats.owing },
          ] as { key: Filter; label: string; count: number }[]).map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <Panel flush>
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </Panel>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <Store className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900">
              {hasFilters ? "No shops match your search" : "No shops yet"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? "Try a different name or clear the filter."
                : "Add your first shop to start raising invoices."}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => { setSearch(""); setFilter("all"); }}
                className="mt-3 text-sm font-medium text-brand-700 hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <div className="mt-4">{addShop}</div>
            )}
          </div>
        </Panel>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <Panel
          title={plural(filtered.length, "shop")}
          description={filter === "balance" ? "Highest balance first" : "Highest balance listed first"}
          flush
        >
          <ul className="divide-y divide-gray-100">
            {filtered.map(shop => {
              const balance = Number(shop.outstandingBalance) || 0;
              return (
                <li key={shop.id} className="flex items-center">
                  <Link
                    href={`/dashboard/shops/${shop.id}`}
                    className="group flex min-h-[64px] min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-700"
                      aria-hidden="true"
                    >
                      {initials(shop.name ?? "")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-gray-900">{shop.name}</p>
                        {shop.active === false && <Badge variant="danger">Inactive</Badge>}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {shop.ownerName}
                        {shop.city ? ` · ${shop.city}` : ""}
                      </p>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      {balance > 0 ? (
                        <>
                          <p className="text-sm font-semibold tabular-nums text-amber-800">
                            {formatLKR(balance)}
                          </p>
                          <p className="text-xs text-gray-500">Outstanding</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Clear</p>
                      )}
                    </div>

                    <ChevronRight
                      className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600"
                      aria-hidden="true"
                    />
                  </Link>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setToDelete(shop)}
                      aria-label={`Delete ${shop.name}`}
                      title="Delete shop"
                      className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete shop"
          description={`${toDelete.name} - ${toDelete.city}\nOwner: ${toDelete.ownerName}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}