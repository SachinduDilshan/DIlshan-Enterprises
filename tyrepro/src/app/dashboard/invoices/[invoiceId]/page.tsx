"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc, getDoc, getDocs, query, orderBy, onSnapshot,
} from "firebase/firestore";
import { invoicesCol, invoiceItemsCol, chequesCol } from "@/lib/firestore-collections";
import { collection, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, formatDate, paymentLabel } from "@/lib/utils";
import { ArrowLeft, FileText, Store, Calendar, CreditCard } from "lucide-react";
import Link from "next/link";
import type { Invoice, InvoiceItem, Cheque, InvoiceStatus, ChequeStatus } from "@/types";

const STATUS_VARIANT: Record<InvoiceStatus, "default"|"info"|"success"|"danger"> = {
  draft:     "default",
  confirmed: "info",
  delivered: "success",
  cancelled: "danger",
};

const CHEQUE_VARIANT: Record<ChequeStatus, "default"|"warning"|"success"|"danger"> = {
  pending:   "warning",
  deposited: "success",
  bounced:   "danger",
  cancelled: "default",
};

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems]     = useState<InvoiceItem[]>([]);
  const [cheque, setCheque]   = useState<Cheque | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Invoice
      const invSnap = await getDoc(doc(invoicesCol, invoiceId));
      if (!invSnap.exists()) { setLoading(false); return; }
      const inv = { id: invSnap.id, ...invSnap.data() } as Invoice;
      setInvoice(inv);

      // Line items
      const itemsSnap = await getDocs(invoiceItemsCol(invoiceId));
      setItems(itemsSnap.docs.map(d => ({ id: d.id, ...d.data() } as InvoiceItem)));

      // Cheque if applicable
      if (inv.chequeId) {
        const cheqSnap = await getDoc(doc(db, "cheques", inv.chequeId));
        if (cheqSnap.exists()) setCheque({ id: cheqSnap.id, ...cheqSnap.data() } as Cheque);
      }

      setLoading(false);
    }
    load();
  }, [invoiceId]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>;
  }

  if (!invoice) {
    return <div className="p-6 text-sm text-gray-500">Invoice not found.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-12">
      {/* Back */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/invoices">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-gray-900">{invoice.invoiceNo}</h1>
            <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status}</Badge>
          </div>
          <p className="text-xs text-gray-400">{formatDate(invoice.invoiceDate)}</p>
        </div>
      </div>

      {/* Company header */}
      <Card className="mb-4 bg-brand-600 text-white border-0">
        <p className="text-base font-semibold">Dilshan Enterprises</p>
        <p className="text-xs text-brand-100">Tire Distributors — Anuradhapura District</p>
        <div className="mt-3 pt-3 border-t border-brand-500 flex justify-between">
          <div>
            <p className="text-xs text-brand-200">Invoice no.</p>
            <p className="text-sm font-medium">{invoice.invoiceNo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brand-200">Date</p>
            <p className="text-sm font-medium">{formatDate(invoice.invoiceDate)}</p>
          </div>
        </div>
      </Card>

      {/* Shop info */}
      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50">
            <Store className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{invoice.shopName}</p>
            <p className="text-xs text-gray-500">{invoice.warehouseName} warehouse</p>
          </div>
        </div>
      </Card>

      {/* Line items */}
      <Card className="mb-4" padding={false}>
        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-sm font-medium text-gray-700">Items</p>
        </div>
        {items.map((item, i) => (
          <div key={item.id} className={`flex items-center justify-between px-4 py-3 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}>
            <div>
              <p className="text-sm font-medium text-gray-900">{item.productName}</p>
              <p className="text-xs text-gray-400">{item.productSku} · {item.qty} × {formatLKR(item.unitPrice)}</p>
            </div>
            <span className="text-sm font-medium text-gray-900">{formatLKR(item.lineTotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-2xl">
          <span className="text-sm font-medium text-gray-700">Total</span>
          <span className="text-lg font-semibold text-gray-900">{formatLKR(invoice.totalAmount)}</span>
        </div>
      </Card>

      {/* Payment */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
            <CreditCard className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{paymentLabel(invoice.paymentType)}</p>
            <p className="text-xs text-gray-500">Payment method</p>
          </div>
        </div>

        {cheque && (
          <div className="rounded-xl bg-gray-50 p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Cheque no.</span>
              <span className="font-medium text-gray-800">{cheque.chequeNo}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Bank</span>
              <span className="font-medium text-gray-800">{cheque.bank}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Due date</span>
              <span className="font-medium text-gray-800">{formatDate(cheque.dueDate)}</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span className="text-gray-500">Status</span>
              <Badge variant={CHEQUE_VARIANT[cheque.status]}>{cheque.status}</Badge>
            </div>
            {cheque.depositedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Deposited</span>
                <span className="font-medium text-green-700">{formatDate(cheque.depositedAt)}</span>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
