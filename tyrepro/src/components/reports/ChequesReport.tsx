"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate } from "@/lib/utils";
import { CalendarClock, CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, Download } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { Timestamp } from "firebase/firestore";
import type { Cheque } from "@/types";

function daysDiff(ts: Timestamp) {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / 86_400_000);
}

export default function ChequesReport() {
  const { appUser } = useAuth();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "deposited" | "bounced">("all");
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "cheques"), orderBy("dueDate", "asc")));
        setCheques(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cheque)));
      } catch { }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? cheques : cheques.filter(c => c.status === filter);
  const pending = cheques.filter(c => c.status === "pending");
  const deposited = cheques.filter(c => c.status === "deposited");
  const bounced = cheques.filter(c => c.status === "bounced");
  const overdue = pending.filter(c => daysDiff(c.dueDate) < 0);
  const pendingTotal = pending.reduce((s, c) => s + c.amount, 0);
  const depositedTotal = deposited.reduce((s, c) => s + c.amount, 0);

  const filterLabel = filter === "all" ? "All cheques" : filter.charAt(0).toUpperCase() + filter.slice(1);

  function handleExcelExport() {
    exportToExcel(
      filtered.map(c => ({
        "Shop": c.shopName,
        "Invoice": c.invoiceNo,
        "Bank": c.bank,
        "Cheque No": c.chequeNo,
        "Amount (Rs)": c.amount,
        "Due Date": formatDate(c.dueDate),
        "Status": c.status,
        "Deposited": c.depositedAt ? formatDate(c.depositedAt) : "—",
      })),
      `Cheques-${filterLabel.replace(/\s/g, "-")}`,
      "Cheques"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      "Cheque Collection Report",
      filterLabel,
      ["Shop", "Invoice", "Bank", "Cheque No", "Amount", "Due Date", "Status"],
      filtered.map(c => [
        c.shopName, c.invoiceNo, c.bank, c.chequeNo,
        `Rs ${c.amount.toLocaleString()}`,
        formatDate(c.dueDate), c.status,
      ]),
      [
        { label: "Pending", value: `${pending.length} · ${formatLKR(pendingTotal)}` },
        { label: "Deposited", value: `${deposited.length} · ${formatLKR(depositedTotal)}` },
        { label: "Overdue", value: String(overdue.length) },
        { label: "Bounced", value: String(bounced.length) },
      ]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base font-medium text-gray-800">Cheque collection report</h2>
        {isAdmin && !loading && filtered.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={handleExcelExport} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
            </Button>
            <Button size="sm" variant="secondary" onClick={handlePDFExport} className="gap-1.5">
              <Download className="h-4 w-4 text-red-500" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 w-full">
        <Card className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-amber-50 p-2.5 flex-shrink-0"><CalendarClock className="h-5 w-5 text-amber-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-base font-semibold text-gray-900 truncate">{pending.length} · {formatLKR(pendingTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-green-50 p-2.5 flex-shrink-0"><CheckCircle className="h-5 w-5 text-green-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Deposited</p>
            <p className="text-base font-semibold text-gray-900 truncate">{deposited.length} · {formatLKR(depositedTotal)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-red-50 p-2.5 flex-shrink-0"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Overdue</p>
            <p className="text-base font-semibold text-red-700 truncate">{overdue.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 min-w-0">
          <div className="rounded-xl bg-gray-100 p-2.5 flex-shrink-0"><XCircle className="h-5 w-5 text-gray-600" /></div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Bounced</p>
            <p className="text-base font-semibold text-gray-900 truncate">{bounced.length}</p>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "pending", "deposited", "bounced"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${filter === f ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)} ({f === "all" ? cheques.length : f === "pending" ? pending.length : f === "deposited" ? deposited.length : bounced.length})
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}
      {!loading && filtered.length === 0 && <Card className="py-10 text-center text-sm text-gray-400">No cheques found</Card>}

      <Card padding={false}>
        {filtered.map((c, i) => {
          const days = daysDiff(c.dueDate);
          const isOverdue = c.status === "pending" && days < 0;
          return (
            <div key={c.id} className={`flex items-start justify-between gap-2 px-4 py-3 ${i < filtered.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.shopName}</p>
                  {isOverdue && <Badge variant="danger">Overdue {Math.abs(days)}d</Badge>}
                </div>
                <p className="text-xs text-gray-400 truncate">#{c.chequeNo} · {c.bank} · Due: {formatDate(c.dueDate)}</p>
                <p className="text-xs text-gray-400 truncate">{c.invoiceNo}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-gray-900">{formatLKR(c.amount)}</p>
                <Badge variant={c.status === "deposited" ? "success" : c.status === "bounced" ? "danger" : isOverdue ? "danger" : "warning"}>{c.status}</Badge>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}