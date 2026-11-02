"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  collection, deleteDoc, doc, getDocs, limit, orderBy,
  query, startAfter, where,
} from "firebase/firestore";
import type { QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore";
import { ChevronRight, FileText, Plus, Search, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { cn, formatDate, formatLKR } from "@/lib/utils";
import type { Invoice, InvoiceStatus } from "@/types";

const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: "",          label: "All"       },
  { value: "confirmed", label: "Confirmed" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<InvoiceStatus, "success" | "info" | "danger" | "default"> = {
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
  draft: "default",
};

function paymentText(type?: string): string {
  if (!type) return "-";
  if (type === "cash") return "Cash";
  if (type === "card") return "Card";
  if (type === "pending") return "Pending";
  if (type.startsWith("cheque_")) return type.replace("cheque_", "Cheque ").replace(/d$/, " days");
  return type;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function InvoicesPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);

  // Ignore results from a request that has been replaced by a newer one
  const requestId = useRef(0);

  async function fetchInvoices(reset = false) {
    const id = ++requestId.current;
    setLoading(true);
    setError("");

    try {
      const constraints: QueryConstraint[] = [];
      if (statusFilter) constraints.push(where("status", "==", statusFilter));
      constraints.push(orderBy("invoiceDate", "desc"));
      if (!reset && lastDoc) constraints.push(startAfter(lastDoc));
      constraints.push(limit(PAGE_SIZE));

      const snap = await getDocs(query(collection(db, "invoices"), ...constraints));
      if (id !== requestId.current) return;

      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id }) as Invoice);
      setInvoices(reset ? docs : prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Invoices load error:", err);
      if (id === requestId.current) {
        setError("Could not load invoices. Check your connection and try again.");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    fetchInvoices(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function handleDelete(invoice: Invoice) {
    await deleteDoc(doc(collection(db, "invoices"), invoice.id));
    setInvoices(prev => prev.filter(i => i.id !== invoice.id));
    setToDelete(null);
  }

  /* ---------------- derived ---------------- */

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      inv =>
        inv.shopName?.toLowerCase().includes(q) ||
        inv.invoiceNo?.toLowerCase().includes(q)
    );
  }, [invoices, search]);

  const total = useMemo(
    () =>
      displayed
        .filter(i => i.status !== "cancelled")
        .reduce((s, i) => s + (Number(i.totalAmount) || 0), 0),
    [displayed]
  );

  const newInvoice = (
    <Link
      href="/dashboard/invoices/new"
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:h-10"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      New invoice
    </Link>
  );

  const firstLoad = loading && invoices.length === 0;
  const hasFilters = search.trim() !== "" || statusFilter !== "";

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Invoices"
        description="Every sale, newest first"
        actions={newInvoice}
      />

      {/* Toolbar */}
      <div className="mb-4 space-y-3">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shop or invoice number"
            aria-label="Search invoices"
            className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:h-10"
          />
        </div>

        <div
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
          role="group"
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              aria-pressed={statusFilter === f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "inline-flex h-10 flex-shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                statusFilter === f.value
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => fetchInvoices(true)}
            className="flex-shrink-0 font-medium underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* First load */}
      {firstLoad && (
        <Panel flush>
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </Panel>
      )}

      {/* Empty */}
      {!loading && !error && displayed.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <FileText className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900">
              {hasFilters ? "No invoices match" : "No invoices yet"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {hasFilters
                ? "Try a different search or status."
                : "Create your first invoice to record a sale."}
            </p>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => { setSearch(""); setStatusFilter(""); }}
                className="mt-3 text-sm font-medium text-brand-700 hover:underline"
              >
                Clear filters
              </button>
            ) : (
              <div className="mt-4">{newInvoice}</div>
            )}
          </div>
        </Panel>
      )}

      {/* List */}
      {displayed.length > 0 && (
        <Panel
          title={plural(displayed.length, "invoice")}
          description={
            search.trim() ? "Searching loaded invoices only" : undefined
          }
          flush
        >
          <ul className="divide-y divide-gray-100">
            {displayed.map(inv => (
              <li key={inv.id} className="flex items-center">
                <Link
                  href={`/dashboard/invoices/${inv.id}`}
                  className="group flex min-h-[64px] min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">{inv.shopName}</p>
                      <Badge variant={STATUS_BADGE[inv.status] ?? "default"}>
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {inv.invoiceNo} · {paymentText(inv.paymentType)} · {formatDate(inv.invoiceDate)}
                    </p>
                  </div>

                  <p
                    className={cn(
                      "flex-shrink-0 text-sm font-semibold tabular-nums",
                      inv.status === "cancelled" ? "text-gray-400 line-through" : "text-gray-900"
                    )}
                  >
                    {formatLKR(Number(inv.totalAmount) || 0)}
                  </p>

                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-gray-600"
                    aria-hidden="true"
                  />
                </Link>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setToDelete(inv)}
                    aria-label={`Delete invoice ${inv.invoiceNo}`}
                    title="Delete invoice"
                    className="mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between rounded-b-xl border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-sm font-medium text-gray-700">
              Total <span className="font-normal text-gray-500">(excluding cancelled)</span>
            </p>
            <p className="text-sm font-semibold tabular-nums text-gray-900">{formatLKR(total)}</p>
          </div>
        </Panel>
      )}

      {hasMore && !firstLoad && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => fetchInvoices(false)}
            disabled={loading}
            className="inline-flex h-11 items-center rounded-lg border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:h-10"
          >
            {loading ? "Loading..." : "Load more invoices"}
          </button>
        </div>
      )}

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete invoice"
          description={`${toDelete.invoiceNo} - ${toDelete.shopName}\n${formatLKR(toDelete.totalAmount)} · ${paymentText(toDelete.paymentType)}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}