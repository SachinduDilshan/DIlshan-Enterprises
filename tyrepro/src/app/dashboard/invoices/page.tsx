"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection, query, orderBy, limit, getDocs,
  where, startAfter, QueryDocumentSnapshot, doc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { formatLKR, formatDate, paymentLabel } from "@/lib/utils";
import { Plus, FileText, ChevronRight, Trash2 } from "lucide-react";
import type { Invoice, InvoiceStatus } from "@/types";

const PAGE_SIZE = 20;

const STATUS_OPTS = [
  { value: "",          label: "All statuses" },
  { value: "confirmed", label: "Confirmed"    },
  { value: "delivered", label: "Delivered"    },
  { value: "cancelled", label: "Cancelled"    },
];

const statusBadge: Record<InvoiceStatus, "success"|"info"|"danger"|"default"> = {
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
  draft:     "default",
};

export default function InvoicesPage() {
  const { appUser }                 = useAuth();
  const [invoices, setInvoices]     = useState<Invoice[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatus]   = useState("");
  const [search, setSearch]         = useState("");
  const [lastDoc, setLastDoc]       = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore]       = useState(false);
  const [toDelete, setToDelete]     = useState<Invoice | null>(null);

  const isAdmin = appUser?.role === "admin";

  async function fetchInvoices(reset = false) {
    setLoading(true);
    try {
      let q = query(
        collection(db, "invoices"),
        orderBy("invoiceDate", "desc"),
        limit(PAGE_SIZE)
      );
      if (statusFilter) {
        q = query(
          collection(db, "invoices"),
          where("status", "==", statusFilter),
          orderBy("invoiceDate", "desc"),
          limit(PAGE_SIZE)
        );
      }
      if (!reset && lastDoc) {
        q = query(
          collection(db, "invoices"),
          orderBy("invoiceDate", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
      setInvoices(reset ? docs : prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInvoices(true); }, [statusFilter]);

  async function handleDelete(invoice: Invoice) {
    await deleteDoc(doc(db, "invoices", invoice.id));
    setInvoices(prev => prev.filter(i => i.id !== invoice.id));
    setToDelete(null);
  }

  const displayed = search
    ? invoices.filter(inv =>
        inv.shopName.toLowerCase().includes(search.toLowerCase()) ||
        inv.invoiceNo.toLowerCase().includes(search.toLowerCase())
      )
    : invoices;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">All sales records</p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> New invoice
          </Button>
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Search shop or invoice no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          options={STATUS_OPTS}
          className="w-40"
        />
      </div>

      {loading && invoices.length === 0 && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <FileText className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No invoices yet</p>
          <Link href="/dashboard/invoices/new" className="mt-4">
            <Button size="sm">Create first invoice</Button>
          </Link>
        </Card>
      )}

      <Card padding={false}>
        {displayed.map((inv, i) => (
          <div
            key={inv.id}
            className={`flex items-center gap-2 px-4 py-3 ${i < displayed.length - 1 ? "border-b border-gray-50" : ""}`}
          >
            {/* Main row — tappable */}
            <Link href={`/dashboard/invoices/${inv.id}`} className="flex flex-1 items-center gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                  <Badge variant={statusBadge[inv.status]}>{inv.status}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {inv.invoiceNo} · {paymentLabel(inv.paymentType)} · {formatDate(inv.invoiceDate)}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-medium text-gray-900">{formatLKR(inv.totalAmount)}</span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </Link>

            {/* Delete — admin only */}
            {isAdmin && (
              <button
                onClick={() => setToDelete(inv)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                title="Delete invoice"
              >
                <Trash2 className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>
        ))}
      </Card>

      {hasMore && (
        <Button
          variant="secondary"
          className="w-full mt-4"
          onClick={() => fetchInvoices(false)}
          loading={loading}
        >
          Load more
        </Button>
      )}

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete invoice"
          description={`${toDelete.invoiceNo} — ${toDelete.shopName}\n${formatLKR(toDelete.totalAmount)} · ${paymentLabel(toDelete.paymentType)}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}