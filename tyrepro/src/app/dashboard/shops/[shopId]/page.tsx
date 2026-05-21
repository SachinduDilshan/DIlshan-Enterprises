"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  doc, getDoc, getDocs, query, where,
  orderBy, limit, onSnapshot, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { shopsCol, invoicesCol, chequesCol } from "@/lib/firestore-collections";
import { collection } from "firebase/firestore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate, paymentLabel } from "@/lib/utils";
import { ArrowLeft, Store, Phone, MapPin, FileText, CalendarClock, Edit2, Check, X } from "lucide-react";
import Link from "next/link";
import type { Shop, Invoice, Cheque } from "@/types";

export default function ShopDetailPage() {
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop]           = useState<Shop | null>(null);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [cheques, setCheques]     = useState<Cheque[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<"invoices" | "cheques">("invoices");

  useEffect(() => {
    // Real-time shop doc
    const unsub = onSnapshot(doc(shopsCol, shopId), snap => {
      if (snap.exists()) setShop({ id: snap.id, ...snap.data() } as Shop);
    });
    return unsub;
  }, [shopId]);

  useEffect(() => {
    async function load() {
      // Last 20 invoices
      const invSnap = await getDocs(
        query(
          invoicesCol,
          where("shopId", "==", shopId),
          orderBy("invoiceDate", "desc"),
          limit(20)
        )
      );
      setInvoices(invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));

      // All pending cheques
      const cheqSnap = await getDocs(
        query(
          chequesCol,
          where("shopId", "==", shopId),
          orderBy("dueDate", "asc")
        )
      );
      setCheques(cheqSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cheque)));

      setLoading(false);
    }
    if (shopId) load();
  }, [shopId]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>;
  }

  if (!shop) {
    return <div className="p-6 text-sm text-gray-500">Shop not found.</div>;
  }

  const pendingCheques = cheques.filter(c => c.status === "pending");
  const pendingTotal   = pendingCheques.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-12">
      {/* Back */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/shops">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-medium text-gray-900">{shop.name}</h1>
          <p className="text-xs text-gray-400">{shop.city} · {shop.assignedWarehouseId}</p>
        </div>
        <Link href={`/dashboard/invoices/new?shopId=${shop.id}`}>
          <Button size="sm">New invoice</Button>
        </Link>
      </div>

      {/* Shop info card */}
      <Card className="mb-4">
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <Store className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Owner</p>
              <p className="text-sm font-medium text-gray-900">{shop.ownerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <a href={`tel:${shop.phone}`} className="text-sm text-brand-600 hover:underline">
              {shop.phone}
            </a>
          </div>
          {shop.address && (
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-700">{shop.address}, {shop.city}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Balance summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="text-center">
          <p className={`text-xl font-semibold ${shop.outstandingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatLKR(shop.outstandingBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Outstanding balance</p>
        </Card>
        <Card className="text-center">
          <p className="text-xl font-semibold text-amber-700">{pendingCheques.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Pending cheques{pendingTotal > 0 ? ` · ${formatLKR(pendingTotal)}` : ""}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl border border-gray-200 overflow-hidden">
        {(["invoices", "cheques"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "invoices" ? `Invoices (${invoices.length})` : `Cheques (${cheques.length})`}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {tab === "invoices" && (
        <Card padding={false}>
          {invoices.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">No invoices yet</div>
          )}
          {invoices.map((inv, i) => (
            <Link key={inv.id} href={`/dashboard/invoices/${inv.id}`}>
              <div className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer ${i < invoices.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.invoiceNo}</p>
                  <p className="text-xs text-gray-400">{formatDate(inv.invoiceDate)} · {paymentLabel(inv.paymentType)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatLKR(inv.totalAmount)}</p>
                  <Badge variant={inv.status === "confirmed" ? "info" : inv.status === "delivered" ? "success" : "default"}>
                    {inv.status}
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}

      {/* Cheque list */}
      {tab === "cheques" && (
        <Card padding={false}>
          {cheques.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">No cheques</div>
          )}
          {cheques.map((c, i) => (
            <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${i < cheques.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div>
                <p className="text-sm font-medium text-gray-900">#{c.chequeNo}</p>
                <p className="text-xs text-gray-400">{c.bank} · Due: {formatDate(c.dueDate)}</p>
                <p className="text-xs text-gray-400">{c.invoiceNo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{formatLKR(c.amount)}</p>
                <Badge variant={c.status === "deposited" ? "success" : c.status === "pending" ? "warning" : "danger"}>
                  {c.status}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
