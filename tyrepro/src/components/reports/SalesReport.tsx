"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate } from "@/lib/utils";
import {
  TrendingUp, FileText, CreditCard, Banknote,
  Download, FileSpreadsheet, Calendar,
  ChevronDown,
} from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types";

// ── Period options ────────────────────────────────────────

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "lastyear", label: "Last year" },
  { value: "alltime", label: "All time" },
];

function getDateRange(range: string, customFrom?: string, customTo?: string): {
  start: Date; end: Date; label: string;
} {
  const now = new Date();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return { start, end, label: "Today" };

    case "yesterday": {
      const s = new Date(now); s.setDate(now.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setDate(now.getDate() - 1); e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: "Yesterday" };
    }

    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
      return { start: s, end, label: "Last 7 days" };
    }

    case "month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end, label: "This month" };
    }

    case "lastmonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: "Last month" };
    }

    case "quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const s = new Date(now.getFullYear(), qStart, 1);
      return { start: s, end, label: "This quarter" };
    }

    case "year": {
      const s = new Date(now.getFullYear(), 0, 1);
      return { start: s, end, label: `This year (${now.getFullYear()})` };
    }

    case "lastyear": {
      const y = now.getFullYear() - 1;
      const s = new Date(y, 0, 1);
      const e = new Date(y, 11, 31); e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: `Last year (${y})` };
    }

    case "alltime": {
      const s = new Date(2020, 0, 1);
      return { start: s, end, label: "All time" };
    }

    case "custom": {
      const s = customFrom
        ? new Date(customFrom)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = customTo ? new Date(customTo) : new Date(now);
      s.setHours(0, 0, 0, 0); e.setHours(23, 59, 59, 999);
      return {
        start: s, end: e,
        label: `${s.toLocaleDateString("en-LK", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })}`,
      };
    }

    default:
      return { start, end, label: "Today" };
  }
}

// ── Stat card ─────────────────────────────────────────────

function StatCard({ icon: Icon, bg, fg, label, value, loading }: {
  icon: React.ElementType; bg: string; fg: string;
  label: string; value: string; loading: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 min-w-0">
      <div className={cn("rounded-xl p-2.5 flex-shrink-0", bg)}>
        <Icon className={cn("h-5 w-5", fg)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-semibold text-gray-900 truncate">
          {loading ? "—" : value}
        </p>
      </div>
    </Card>
  );
}


function PeriodSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  value: string;
  onChange: (v: string) => void;
  customFrom: string;
  customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const PRESETS = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "Last 7 days" },
    { value: "month", label: "This month" },
    { value: "lastmonth", label: "Last month" },
    { value: "quarter", label: "This quarter" },
    { value: "year", label: "This year" },
    { value: "lastyear", label: "Last year" },
    { value: "alltime", label: "All time" },
  ];

  const selectedLabel = value === "custom"
    ? customFrom && customTo
      ? `${new Date(customFrom).toLocaleDateString("en-LK", { day: "2-digit", month: "short" })} – ${new Date(customTo).toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })}`
      : "Custom range"
    : PRESETS.find(p => p.value === value)?.label ?? "Select period";

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          open
            ? "border-brand-400 bg-brand-50 text-brand-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        )}
      >
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>{selectedLabel}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
          {/* Preset grid */}
          <div className="p-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Quick select
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button key={p.value}
                  onClick={() => { onChange(p.value); setOpen(false); }}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors text-center",
                    value === p.value && value !== "custom"
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white hover:text-gray-900"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100 mx-3" />

          {/* Custom range */}
          <div className="p-3">
            <button
              onClick={() => onChange("custom")}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                value === "custom"
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600"
              )}
            >
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              Custom date range
            </button>

            {value === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-medium text-brand-600 block mb-1">From</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={e => onCustomFromChange(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-brand-400"
                  />
                </div>
                <span className="text-gray-400 text-sm mt-4">→</span>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-medium text-brand-600 block mb-1">To</label>
                  <input
                    type="date"
                    value={customTo}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => onCustomToChange(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-brand-400"
                  />
                </div>
              </div>
            )}

            {value === "custom" && customFrom && customTo && (
              <button
                onClick={() => { onChange("month"); onCustomFromChange(""); onCustomToChange(""); }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear custom range
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export default function DailySalesReport() {
  const { appUser } = useAuth();
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const canExport = appUser?.role === "admin" || appUser?.role === "sales_rep";

  const { start, end, label } = getDateRange(range, customFrom, customTo);
  const showGrouped = ["year", "lastyear", "alltime", "quarter"].includes(range);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    async function load() {
      try {
        const snap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(start)),
          where("invoiceDate", "<=", Timestamp.fromDate(end)),
          orderBy("invoiceDate", "desc")
        ));
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      } catch { }
      setLoading(false);
    }
    load();
  }, [range, customFrom, customTo]);

  const totalSales = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const cashSales = invoices.filter(i => i.paymentType === "cash").reduce((s, i) => s + i.totalAmount, 0);
  const chequeSales = invoices.filter(i => i.paymentType !== "cash").reduce((s, i) => s + i.totalAmount, 0);

  // Group by date (short ranges)
  const byDate: Record<string, Invoice[]> = {};
  invoices.forEach(inv => {
    const d = formatDate(inv.invoiceDate, "dd MMM yyyy");
    byDate[d] = [...(byDate[d] ?? []), inv];
  });

  // Monthly breakdown (long ranges)
  const byMonth: Record<string, { total: number; count: number }> = {};
  if (showGrouped) {
    invoices.forEach(inv => {
      const m = inv.invoiceDate.toDate().toLocaleDateString("en-LK", { month: "long", year: "numeric" });
      byMonth[m] = byMonth[m]
        ? { total: byMonth[m].total + inv.totalAmount, count: byMonth[m].count + 1 }
        : { total: inv.totalAmount, count: 1 };
    });
  }

  function handleExcelExport() {
    exportToExcel(
      invoices.map(inv => ({
        "Invoice No": inv.invoiceNo,
        "Shop": inv.shopName,
        "Date": formatDate(inv.invoiceDate, "dd MMM yyyy"),
        "Payment": inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days"),
        "Amount (Rs)": inv.totalAmount,
        "Warehouse": inv.warehouseName,
      })),
      `Sales-${label.replace(/[\s/–]/g, "-")}`,
      "Sales"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      `Sales Report — ${label}`,
      label,
      ["Invoice No", "Shop", "Date", "Payment", "Amount (Rs)", "Warehouse"],
      invoices.map(inv => [
        inv.invoiceNo, inv.shopName,
        formatDate(inv.invoiceDate, "dd MMM yyyy"),
        inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days"),
        `Rs ${inv.totalAmount.toLocaleString()}`,
        inv.warehouseName,
      ]),
      [
        { label: "Total Sales", value: formatLKR(totalSales) },
        { label: "Cash Sales", value: formatLKR(cashSales) },
        { label: "Cheque Sales", value: formatLKR(chequeSales) },
        { label: "Total Invoices", value: String(invoices.length) },
        { label: "Period", value: label },
      ]
    );
  }

  // Custom range label for the pill button
  const customLabel = customFrom && customTo
    ? `${new Date(customFrom).toLocaleDateString("en-LK", { day: "2-digit", month: "short" })} – ${new Date(customTo).toLocaleDateString("en-LK", { day: "2-digit", month: "short" })}`
    : "Custom range";

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-medium text-gray-800">Sales — {label}</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{invoices.length} invoices</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExport && !loading && invoices.length > 0 && (
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
            value={range}
            onChange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <StatCard icon={TrendingUp} bg="bg-brand-50" fg="text-brand-600" label="Total sales" value={formatLKR(totalSales)} loading={loading} />
        <StatCard icon={FileText} bg="bg-gray-100" fg="text-gray-600" label="Invoices" value={String(invoices.length)} loading={loading} />
        <StatCard icon={Banknote} bg="bg-green-50" fg="text-green-600" label="Cash sales" value={formatLKR(cashSales)} loading={loading} />
        <StatCard icon={CreditCard} bg="bg-amber-50" fg="text-amber-600" label="Cheque sales" value={formatLKR(chequeSales)} loading={loading} />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && invoices.length === 0 && (
        <Card className="py-10 text-center text-sm text-gray-400">
          {range === "custom" && (!customFrom || !customTo)
            ? "Select a date range above to view sales"
            : "No sales in this period"}
        </Card>
      )}

      {/* Monthly breakdown — for long periods */}
      {!loading && showGrouped && Object.keys(byMonth).length > 0 && (
        <Card padding={false}>
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50 rounded-t-2xl">
            <p className="text-sm font-medium text-gray-700">Monthly breakdown</p>
          </div>
          {Object.entries(byMonth).map(([month, data], i, arr) => (
            <div key={month}
              className={cn(
                "flex items-center justify-between px-4 py-3",
                i < arr.length - 1 && "border-b border-gray-50"
              )}>
              <div>
                <p className="text-sm font-medium text-gray-900">{month}</p>
                <p className="text-xs text-gray-400">{data.count} invoices</p>
              </div>
              <p className="text-sm font-medium text-gray-900">{formatLKR(data.total)}</p>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-brand-50 rounded-b-2xl border-t border-brand-100">
            <p className="text-sm font-semibold text-brand-800">Total</p>
            <p className="text-sm font-semibold text-brand-900">{formatLKR(totalSales)}</p>
          </div>
        </Card>
      )}

      {/* Daily breakdown — for short periods */}
      {!loading && !showGrouped && Object.entries(byDate).map(([date, invs]) => (
        <Card key={date} padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50 rounded-t-2xl">
            <span className="text-sm font-medium text-gray-700">{date}</span>
            <span className="text-sm font-medium text-gray-900">
              {formatLKR(invs.reduce((s, i) => s + i.totalAmount, 0))} · {invs.length} invoices
            </span>
          </div>
          {invs.map((inv, i) => (
            <div key={inv.id}
              className={cn(
                "flex items-center justify-between px-4 py-3",
                i < invs.length - 1 && "border-b border-gray-50"
              )}>
              <div className="min-w-0 flex-1 pr-3">
                <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                <p className="text-xs text-gray-400">
                  {inv.invoiceNo} · {inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_", "Cheque ").replace("d", " days")}
                </p>
              </div>
              <span className="text-sm font-medium text-gray-900 flex-shrink-0">
                {formatLKR(inv.totalAmount)}
              </span>
            </div>
          ))}
        </Card>
      ))}

    </div>
  );
}