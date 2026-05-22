"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatLKR, formatDate } from "@/lib/utils";
import { CalendarClock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { Cheque } from "@/types";

function daysDiff(ts: Timestamp) {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86_400_000);
}

export default function ChequesReport() {
  const [cheques, setCheques]   = useState<Cheque[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "pending" | "deposited" | "bounced">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, "cheques"), orderBy("dueDate", "asc"))
        );
        setCheques(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cheque)));
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? cheques : cheques.filter(c => c.status === filter);

  const pending   = cheques.filter(c => c.status === "pending");
  const deposited = cheques.filter(c => c.status === "deposited");
  const bounced   = cheques.filter(c => c.status === "bounced");
  const overdue   = pending.filter(c => daysDiff(c.dueDate) < 0);

  const pendingTotal   = pending.reduce((s, c) => s + c.amount, 0);
  const depositedTotal = deposited.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium text-gray-800">Cheque collection report</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5"><CalendarClock className="h-5 w-5 text-amber-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-base font-semibold text-gray-900">{pending.length} · {formatLKR(pendingTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-green-50 p-2.5"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Deposited</p>
            <p className="text-base font-semibold text-gray-900">{deposited.length} · {formatLKR(depositedTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-red-50 p-2.5"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Overdue</p>
            <p className="text-base font-semibold text-red-700">{overdue.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2.5"><XCircle className="h-5 w-5 text-gray-600" /></div>
          <div>
            <p className="text-xs text-gray-500">Bounced</p>
            <p className="text-base font-semibold text-gray-900">{bounced.length}</p>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "pending", "deposited", "bounced"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === "all" ? `(${cheques.length})` : f === "pending" ? `(${pending.length})` : f === "deposited" ? `(${deposited.length})` : `(${bounced.length})`}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}

      {!loading && filtered.length === 0 && (
        <Card className="py-10 text-center text-sm text-gray-400">No cheques found</Card>
      )}

      <Card padding={false}>
        {filtered.map((c, i) => {
          const days      = daysDiff(c.dueDate);
          const isOverdue = c.status === "pending" && days < 0;
          return (
            <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${i < filtered.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">{c.shopName}</p>
                  {isOverdue && <Badge variant="danger">Overdue {Math.abs(days)}d</Badge>}
                </div>
                <p className="text-xs text-gray-400">
                  #{c.chequeNo} · {c.bank} · Due: {formatDate(c.dueDate)}
                </p>
                <p className="text-xs text-gray-400">{c.invoiceNo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{formatLKR(c.amount)}</p>
                <Badge variant={c.status === "deposited" ? "success" : c.status === "bounced" ? "danger" : isOverdue ? "danger" : "warning"}>
                  {c.status}
                </Badge>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
