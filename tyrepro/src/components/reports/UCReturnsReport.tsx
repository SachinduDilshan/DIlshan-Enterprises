"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs,
  where, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { FileSpreadsheet, Download, RotateCcw } from "lucide-react";
import { PeriodSelector, getDateRange } from "@/components/reports/PeriodSelector";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { formatDate, formatLKR } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface UCReturn {
  id:                    string;
  shopName:              string;
  shopCity:              string;
  productName:           string;
  productSku:            string;
  qty:                   number;
  unitPrice:             number;
  totalValue:            number;
  reason:                string;
  status:                string;
  tyreReceivedAt?:       any;
  sentToSupplierAt?:     any;
  replacementReceivedAt?:any;
  createdAt?:            any;
}

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge:       "Sidewall bulge",
  tread_separation:     "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage:          "Bead damage",
  other:                "Other",
};

const STATUS_META: Record<string, { label: string; badge: "warning"|"info"|"default"|"success" }> = {
  approved:             { label: "Tyre with us",        badge: "warning" },
  sent_to_supplier:     { label: "Sent to CEAT",        badge: "info"    },
  awaiting_replacement: { label: "Awaiting replacement",badge: "default" },
  closed:               { label: "Closed",              badge: "success" },
};

const STATUS_FILTERS = [
  { value: "all",                  label: "All"         },
  { value: "approved",             label: "Tyre with us"},
  { value: "sent_to_supplier",     label: "Sent CEAT"   },
  { value: "awaiting_replacement", label: "Awaiting"    },
  { value: "closed",               label: "Closed"      },
];

export default function UCReturnsReport() {
  const { appUser }                   = useAuth();
  const [range, setRange]             = useState("alltime");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [returns, setReturns]         = useState<UCReturn[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const canExport = appUser?.role === "admin" || appUser?.role === "sales_rep";
  const { start, end, label } = getDateRange(range, customFrom, customTo);

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) {
      setLoading(false); setReturns([]); return;
    }
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const snap = await getDocs(query(
          collection(db, "ucReturns"),
          orderBy("createdAt", "desc")
        ));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as UCReturn));
        const filtered = range === "alltime"
          ? all
          : all.filter(r => {
              const d = r.tyreReceivedAt?.toDate?.() ?? r.createdAt?.toDate?.();
              return d && d >= start && d <= end;
            });
        if (!cancelled) setReturns(filtered);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [range, customFrom, customTo]);

  const displayed = statusFilter === "all"
    ? returns
    : returns.filter(r => r.status === statusFilter);

  // Summary stats
  const totalValue  = returns.reduce((s, r) => s + (r.totalValue ?? 0), 0);
  const totalQty    = returns.reduce((s, r) => s + r.qty, 0);
  const activeCount = returns.filter(r => r.status !== "closed").length;
  const closedCount = returns.filter(r => r.status === "closed").length;
  const withUsCount = returns.filter(r => r.status === "approved").length;
  const withCEAT    = returns.filter(r => r.status === "sent_to_supplier" || r.status === "awaiting_replacement").length;

  function handleExcelExport() {
    exportToExcel(
      displayed.map(r => ({
        "Shop":             r.shopName,
        "City":             r.shopCity,
        "Product":          r.productName,
        "SKU":              r.productSku,
        "Qty":              r.qty,
        "Unit price (Rs)":  r.unitPrice,
        "Total value (Rs)": r.totalValue,
        "Reason":           REASON_LABELS[r.reason] ?? r.reason,
        "Status":           STATUS_META[r.status]?.label ?? r.status,
        "Received":         formatDate(r.tyreReceivedAt),
        "Sent to CEAT":     formatDate(r.sentToSupplierAt),
        "Replacement back": formatDate(r.replacementReceivedAt),
      })),
      `UC-Returns-${label.replace(/[\s/–]/g, "-")}`,
      "UC Returns"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      `UC Returns Report — ${label}`,
      label,
      ["Shop","Product","Qty","Value","Reason","Status","Received"],
      displayed.map(r => [
        r.shopName, r.productName, String(r.qty),
        `Rs ${(r.totalValue ?? 0).toLocaleString()}`,
        REASON_LABELS[r.reason] ?? r.reason,
        STATUS_META[r.status]?.label ?? r.status,
        formatDate(r.tyreReceivedAt),
      ]),
      [
        { label: "Total returns",   value: String(returns.length) },
        { label: "Total tyres",     value: String(totalQty)       },
        { label: "Total value",     value: formatLKR(totalValue)  },
        { label: "Active",          value: String(activeCount)    },
        { label: "Closed",          value: String(closedCount)    },
        { label: "Period",          value: label                  },
      ]
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-800">UC Returns — {label}</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">{returns.length} returns · {totalQty} tyres</p>
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

      {/* Summary cards */}
      {!loading && returns.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="text-center">
            <p className="text-xl font-semibold text-amber-700">{activeCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Active returns</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-semibold text-green-700">{closedCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Closed</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-semibold text-amber-700">{withUsCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Tyres with us</p>
          </Card>
          <Card className="text-center">
            <p className="text-xl font-semibold text-blue-700">{withCEAT}</p>
            <p className="text-xs text-gray-500 mt-0.5">With CEAT</p>
          </Card>
        </div>
      )}

      {/* Status filter — scrollable pill strip */}
      <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 min-w-max pb-1">
          {STATUS_FILTERS.map(opt => {
            const count = opt.value === "all"
              ? returns.length
              : returns.filter(r => r.status === opt.value).length;
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                  statusFilter === opt.value
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                )}
              >
                {opt.label}
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  statusFilter === opt.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
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
          <RotateCcw className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No returns found in this period</p>
        </Card>
      )}

      {/* Returns list */}
      {!loading && displayed.length > 0 && (
        <Card padding={false}>
          {displayed.map((r, i) => {
            const statusMeta = STATUS_META[r.status] ?? { label: r.status, badge: "default" as const };
            return (
              <div key={r.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  i < displayed.length - 1 && "border-b border-gray-50"
                )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.shopName}</p>
                    <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{r.productName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {REASON_LABELS[r.reason] ?? r.reason} · {r.qty} tyre{r.qty > 1 ? "s" : ""} · {formatDate(r.tyreReceivedAt)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium text-gray-900">
                    {formatLKR(r.totalValue ?? 0)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Rs {(r.unitPrice ?? 0).toLocaleString()} each
                  </p>
                </div>
              </div>
            );
          })}

          {/* Total row */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700">
              Total ({displayed.length} returns · {displayed.reduce((s,r) => s + r.qty, 0)} tyres)
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatLKR(displayed.reduce((s, r) => s + (r.totalValue ?? 0), 0))}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}     