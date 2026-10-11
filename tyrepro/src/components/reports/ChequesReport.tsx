"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs, where, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileSpreadsheet, Download, CalendarClock } from "lucide-react";
import { PeriodSelector, getDateRange } from "@/components/reports/PeriodSelector";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { formatDate, formatLKR } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Cheque {
  id:           string;
  shopName:     string;
  invoiceNo:    string;
  bank:         string;
  chequeNo:     string;
  amount:       number;
  dueDate:      any;
  depositedAt?: any;
  status:       string;
}

type FilterKey = "all" | "pending" | "deposited";

export default function ChequesReport() {
  const { appUser }                 = useAuth();
  const [range, setRange]           = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const [cheques, setCheques]       = useState<Cheque[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterKey>("all");

  const canExport = appUser?.role === "admin" || appUser?.role === "sales_rep";

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) {
      setLoading(false); setCheques([]); return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        // Load ALL cheques then filter client-side by dueDate
        // This avoids composite index requirements
        const snap = await getDocs(query(
          collection(db, "cheques"),
          orderBy("dueDate", "asc")
        ));

        const all = snap.docs.map(d => ({
          id: d.id, ...d.data(),
        } as Cheque));

        // Filter by date range based on dueDate
        let filtered = all;
        if (range !== "alltime") {
          const { start, end } = getDateRange(range, customFrom, customTo);
          filtered = all.filter(c => {
            if (!c.dueDate) return false;
            const d = c.dueDate?.toDate ? c.dueDate.toDate() : new Date(c.dueDate);
            return d >= start && d <= end;
          });
        }

        if (!cancelled) setCheques(filtered);
      } catch (err) {
        console.error("ChequesReport load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [range, customFrom, customTo]);

  const displayed = filter === "all"
    ? cheques
    : cheques.filter(c => c.status === filter);

  const totalPending   = cheques.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const totalDeposited = cheques.filter(c => c.status === "deposited").reduce((s, c) => s + c.amount, 0);
  const totalOverdue   = cheques.filter(c => {
    if (c.status !== "pending") return false;
    const d = c.dueDate?.toDate ? c.dueDate.toDate() : new Date(c.dueDate);
    return d < new Date();
  });

  const { label } = getDateRange(range, customFrom, customTo);

  function handleExcelExport() {
    exportToExcel(
      displayed.map(c => ({
        "Shop":       c.shopName,
        "Invoice":    c.invoiceNo,
        "Bank":       c.bank,
        "Cheque No":  c.chequeNo,
        "Amount":     c.amount,
        "Due Date":   formatDate(c.dueDate),
        "Status":     c.status,
        "Deposited":  c.depositedAt ? formatDate(c.depositedAt) : "",
      })),
      `Cheques-${label.replace(/[\s/–]/g, "-")}`,
      "Cheques"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      `Cheques Report — ${label}`,
      label,
      ["Shop", "Invoice", "Bank", "Cheque No", "Amount", "Due Date", "Status"],
      displayed.map(c => [
        c.shopName, c.invoiceNo, c.bank, c.chequeNo,
        `Rs ${c.amount.toLocaleString()}`,
        formatDate(c.dueDate), c.status,
      ]),
      [
        { label: "Total pending",   value: formatLKR(totalPending)   },
        { label: "Total deposited", value: formatLKR(totalDeposited) },
        { label: "Overdue",         value: String(totalOverdue.length) },
        { label: "Period",          value: label                     },
      ]
    );
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",       label: `All (${cheques.length})`                              },
    { key: "pending",   label: `Pending (${cheques.filter(c=>c.status==="pending").length})`   },
    { key: "deposited", label: `Deposited (${cheques.filter(c=>c.status==="deposited").length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-800">Cheques — {label}</h2>
          {!loading && <p className="text-xs text-gray-400 mt-0.5">{cheques.length} cheques</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && !loading && displayed.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={handleExcelExport} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={handlePDFExport} className="gap-1.5">
                <Download className="h-4 w-4 text-red-500" /> PDF
              </Button>
            </>
          )}
          <PeriodSelector
            value={range} onChange={setRange}
            customFrom={customFrom} customTo={customTo}
            onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
          />
        </div>
      </div>

      {/* Summary cards */}
      {!loading && cheques.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="text-center">
            <p className="text-xl font-semibold text-amber-700">{formatLKR(totalPending)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pending</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-semibold text-green-700">{formatLKR(totalDeposited)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Deposited</p>
          </Card>
          <Card className="text-center col-span-2 sm:col-span-1">
            <p className="text-xl font-semibold text-red-700">{totalOverdue.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Overdue cheques</p>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 min-w-max pb-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                filter === f.key
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              )}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <CalendarClock className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No cheques in this period</p>
        </Card>
      )}

      {!loading && displayed.length > 0 && (
        <Card padding={false}>
          {displayed.map((c, i) => {
            const due      = c.dueDate?.toDate ? c.dueDate.toDate() : new Date(c.dueDate);
            const isOverdue = c.status === "pending" && due < new Date();
            const days     = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
            return (
              <div key={c.id}
                className={cn("flex items-start gap-3 px-4 py-3",
                  i < displayed.length - 1 && "border-b border-gray-50")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.shopName}</p>
                    <Badge variant={
                      c.status === "deposited" ? "success" :
                      isOverdue ? "danger" : "warning"
                    }>
                      {c.status === "deposited" ? "Deposited" :
                       isOverdue ? `Overdue ${Math.abs(days)}d` :
                       days === 0 ? "Due today" : `Due in ${days}d`}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {c.bank} · #{c.chequeNo} · {c.invoiceNo}
                  </p>
                  <p className="text-xs text-gray-400">
                    Due: {formatDate(c.dueDate)}
                    {c.depositedAt && <> · Deposited: {formatDate(c.depositedAt)}</>}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 flex-shrink-0">
                  {formatLKR(c.amount)}
                </p>
              </div>
            );
          })}
          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700">
              Total ({displayed.length} cheques)
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatLKR(displayed.reduce((s, c) => s + c.amount, 0))}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}