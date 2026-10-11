"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileSpreadsheet, Download, CreditCard } from "lucide-react";
import { PeriodSelector, getDateRange } from "@/components/reports/PeriodSelector";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { formatDate, formatLKR } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Invoice {
  id:          string;
  invoiceNo:   string;
  shopName:    string;
  totalAmount: number;
  paymentType: string;
  status:      string;
  invoiceDate: any;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash:       "Cash",
  card:       "Card",
  cheque_15d: "Cheque (15d)",
  cheque_30d: "Cheque (30d)",
  cheque_45d: "Cheque (45d)",
  cheque_60d: "Cheque (60d)",
  cheque_90d: "Cheque (90d)",
  pending:    "Pending",
};

const PAYMENT_BADGE: Record<string, "success"|"info"|"warning"|"default"> = {
  cash:    "success",
  card:    "info",
  pending: "warning",
};

function getPaymentBadge(type: string): "success"|"info"|"warning"|"default" {
  if (PAYMENT_BADGE[type]) return PAYMENT_BADGE[type];
  if (type.startsWith("cheque_")) return "default";
  return "default";
}

const FILTER_TYPES = [
  { value: "all",     label: "All"     },
  { value: "cash",    label: "Cash"    },
  { value: "card",    label: "Card"    },
  { value: "cheque",  label: "Cheque"  },
  { value: "pending", label: "Pending" },
];

export default function PaymentsReport() {
  const { appUser }                   = useAuth();
  const [range, setRange]             = useState("month");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [loading, setLoading]         = useState(true);
  const [typeFilter, setTypeFilter]   = useState("all");

  const canExport = appUser?.role === "admin" || appUser?.role === "sales_rep";
  const { label } = getDateRange(range, customFrom, customTo);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) {
      setLoading(false); setInvoices([]); return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const snap = await getDocs(query(
          collection(db, "invoices"),
          orderBy("invoiceDate", "desc")
        ));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));

        let filtered = all.filter(inv => inv.status === "confirmed");
        if (range !== "alltime") {
          const { start, end } = getDateRange(range, customFrom, customTo);
          filtered = filtered.filter(inv => {
            if (!inv.invoiceDate) return false;
            const d = inv.invoiceDate?.toDate
              ? inv.invoiceDate.toDate()
              : new Date(inv.invoiceDate);
            return d >= start && d <= end;
          });
        }

        if (!cancelled) setInvoices(filtered);
      } catch (err) {
        console.error("PaymentsReport load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [range, customFrom, customTo]);

  const displayed = typeFilter === "all"
    ? invoices
    : typeFilter === "cheque"
      ? invoices.filter(i => i.paymentType.startsWith("cheque_"))
      : invoices.filter(i => i.paymentType === typeFilter);

  // Summary stats
  const cashTotal    = invoices.filter(i => i.paymentType === "cash").reduce((s,i) => s + i.totalAmount, 0);
  const cardTotal    = invoices.filter(i => i.paymentType === "card").reduce((s,i) => s + i.totalAmount, 0);
  const chequeTotal  = invoices.filter(i => i.paymentType.startsWith("cheque_")).reduce((s,i) => s + i.totalAmount, 0);
  const pendingTotal = invoices.filter(i => i.paymentType === "pending").reduce((s,i) => s + i.totalAmount, 0);
  const grandTotal   = invoices.reduce((s,i) => s + i.totalAmount, 0);

  function handleExcelExport() {
    exportToExcel(
      displayed.map(inv => ({
        "Invoice No":    inv.invoiceNo,
        "Shop":          inv.shopName,
        "Date":          formatDate(inv.invoiceDate),
        "Payment type":  PAYMENT_LABELS[inv.paymentType] ?? inv.paymentType,
        "Amount (Rs)":   inv.totalAmount,
      })),
      `Payments-${label.replace(/[\s/–]/g, "-")}`,
      "Payments"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      `Payments Report — ${label}`,
      label,
      ["Invoice", "Shop", "Date", "Payment", "Amount"],
      displayed.map(inv => [
        inv.invoiceNo, inv.shopName,
        formatDate(inv.invoiceDate),
        PAYMENT_LABELS[inv.paymentType] ?? inv.paymentType,
        `Rs ${inv.totalAmount.toLocaleString()}`,
      ]),
      [
        { label: "Cash",    value: formatLKR(cashTotal)    },
        { label: "Card",    value: formatLKR(cardTotal)    },
        { label: "Cheque",  value: formatLKR(chequeTotal)  },
        { label: "Pending", value: formatLKR(pendingTotal) },
        { label: "Total",   value: formatLKR(grandTotal)   },
        { label: "Period",  value: label                   },
      ]
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-800">Payments — {label}</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{invoices.length} invoices · {formatLKR(grandTotal)}</p>
          )}
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

      {/* Summary breakdown */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <p className="text-lg font-semibold text-green-700">{formatLKR(cashTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">💵 Cash</p>
          </Card>
          <Card className="text-center">
            <p className="text-lg font-semibold text-blue-700">{formatLKR(cardTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">💳 Card</p>
          </Card>
          <Card className="text-center">
            <p className="text-lg font-semibold text-gray-700">{formatLKR(chequeTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">🏦 Cheque</p>
          </Card>
          <Card className="text-center">
            <p className="text-lg font-semibold text-amber-700">{formatLKR(pendingTotal)}</p>
            <p className="text-xs text-gray-500 mt-0.5">⏳ Pending</p>
          </Card>
        </div>
      )}

      {/* Total bar */}
      {!loading && invoices.length > 0 && (
        <Card className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Grand total</p>
          <p className="text-xl font-semibold text-brand-700">{formatLKR(grandTotal)}</p>
        </Card>
      )}

      {/* Type filter */}
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 min-w-max pb-1">
          {FILTER_TYPES.map(f => {
            const count = f.value === "all"
              ? invoices.length
              : f.value === "cheque"
                ? invoices.filter(i => i.paymentType.startsWith("cheque_")).length
                : invoices.filter(i => i.paymentType === f.value).length;
            return (
              <button key={f.value} onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                  typeFilter === f.value
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                )}>
                {f.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  typeFilter === f.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <CreditCard className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No payments in this period</p>
        </Card>
      )}

      {!loading && displayed.length > 0 && (
        <Card padding={false}>
          {displayed.map((inv, i) => (
            <div key={inv.id}
              className={cn("flex items-center gap-3 px-4 py-3",
                i < displayed.length - 1 && "border-b border-gray-50")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                  <Badge variant={getPaymentBadge(inv.paymentType)}>
                    {PAYMENT_LABELS[inv.paymentType] ?? inv.paymentType}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  {inv.invoiceNo} · {formatDate(inv.invoiceDate)}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                {formatLKR(inv.totalAmount)}
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700">
              Total ({displayed.length} invoices)
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatLKR(displayed.reduce((s, i) => s + i.totalAmount, 0))}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}