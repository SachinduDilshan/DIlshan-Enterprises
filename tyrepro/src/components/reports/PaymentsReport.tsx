"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  FileSpreadsheet, Download, CreditCard, CalendarClock,
} from "lucide-react";
import { PeriodSelector, getDateRange } from "@/components/reports/PeriodSelector";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { formatDate, formatLKR } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────

interface Invoice {
  id: string;
  invoiceNo: string;
  shopName: string;
  totalAmount: number;
  paymentType: string;
  status: string;
  invoiceDate: any;
}

interface Cheque {
  id: string;
  invoiceNo: string;
  shopName: string;
  bank: string;
  chequeNo: string;
  amount: number;
  dueDate: any;
  createdAt?: any;
  depositedAt?: any;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  cheque_15d: "Cheque (15d)",
  cheque_30d: "Cheque (30d)",
  cheque_45d: "Cheque (45d)",
  cheque_60d: "Cheque (60d)",
  cheque_90d: "Cheque (90d)",
  pending: "Pending",
};

function paymentBadge(type: string): "success" | "info" | "warning" | "default" {
  if (type === "cash") return "success";
  if (type === "card") return "info";
  if (type === "pending") return "warning";
  return "default";
}

// FIX: handles both Firestore Timestamp and plain date strings
function toDate(val: any): Date | null {
  if (!val) return null;
  // Firestore Timestamp
  if (typeof val?.toDate === "function") return val.toDate();
  // Already a Date
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  // ISO string or number
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ── Tab types ─────────────────────────────────────────────

type MainTab = "invoices" | "cheques";
type InvoiceFilter = "all" | "cash" | "card" | "cheque" | "pending";
type ChequeFilter = "all" | "pending" | "overdue" | "deposited";

// ── Main component ────────────────────────────────────────

export default function PaymentsReport() {
  const { appUser } = useAuth();
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Raw data — loaded once without date filter
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allCheques, setAllCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  const [mainTab, setMainTab] = useState<MainTab>("invoices");
  const [invFilter, setInvFilter] = useState<InvoiceFilter>("all");
  const [cheqFilter, setCheqFilter] = useState<ChequeFilter>("all");

  const canExport = appUser?.role === "admin" || appUser?.role === "sales_rep";

  // ── Load ALL data once on mount ───────────────────────
  // We do NOT filter in Firestore to avoid composite index requirements.
  // All date filtering happens client-side below.

  // ── Load ALL data once on mount ───────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const [invSnap, cheqSnap] = await Promise.all([
          getDocs(query(collection(db, "invoices"), orderBy("invoiceDate", "desc"))),
          getDocs(query(collection(db, "cheques"), orderBy("createdAt", "desc"))),
        ]);

        if (!cancelled) {
          setAllInvoices(
            invSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Invoice))
              .filter(inv => inv.status === "confirmed")
          );
          setAllCheques(
            cheqSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cheque))
          );
        }
      } catch (err) {
        console.error("PaymentsReport load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []); // load only once — filtering is done below

  // ── Client-side date filtering ────────────────────────

  const { start, end, label } = getDateRange(range, customFrom, customTo);

  const isCustomIncomplete = range === "custom" && (!customFrom || !customTo);

  function toDate(val: any): Date | null {
    if (!val) return null;
    if (typeof val?.toDate === "function") return val.toDate();
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function inRange(val: any): boolean {
    if (isCustomIncomplete) return false;
    if (range === "alltime") return true;
    const d = toDate(val);
    if (!d) return false;
    return d >= start && d <= end;
  }

  // Invoices filtered by invoiceDate
  const invoices = allInvoices.filter(inv => inRange(inv.invoiceDate));

  // Cheques filtered by createdAt (when the cheque was issued)
  // This matches the invoice period — a cheque issued this month
  // shows under "this month" even if its due date is next month
  const cheques = allCheques.filter(c => {
    // Use createdAt if available, fall back to dueDate
    const dateToCheck = (c as any).createdAt ?? c.dueDate;
    return inRange(dateToCheck);
  });

  // ── Computed invoice groups ───────────────────────────

  const cashInv = invoices.filter(i => i.paymentType === "cash");
  const cardInv = invoices.filter(i => i.paymentType === "card");
  const chequeInv = invoices.filter(i => i.paymentType.startsWith("cheque_"));
  const pendingInv = invoices.filter(i => i.paymentType === "pending");

  const cashTotal = cashInv.reduce((s, i) => s + i.totalAmount, 0);
  const cardTotal = cardInv.reduce((s, i) => s + i.totalAmount, 0);
  const chequeTotal = chequeInv.reduce((s, i) => s + i.totalAmount, 0);
  const pendingTotal = pendingInv.reduce((s, i) => s + i.totalAmount, 0);
  const grandTotal = invoices.reduce((s, i) => s + i.totalAmount, 0);

  // ── Computed cheque groups ────────────────────────────

  const now = new Date();

  const pendingCheques = cheques.filter(c =>
    c.status === "pending" && (toDate(c.dueDate) ?? now) >= now
  );
  const overdueCheques = cheques.filter(c =>
    c.status === "pending" && (toDate(c.dueDate) ?? now) < now
  );
  const depositedCheques = cheques.filter(c => c.status === "deposited");

  // ── Displayed rows based on filters ──────────────────

  const displayedInv: Invoice[] =
    invFilter === "all" ? invoices
      : invFilter === "cash" ? cashInv
        : invFilter === "card" ? cardInv
          : invFilter === "cheque" ? chequeInv
            : pendingInv;

  const displayedCheq: Cheque[] =
    cheqFilter === "all" ? cheques
      : cheqFilter === "pending" ? pendingCheques
        : cheqFilter === "overdue" ? overdueCheques
          : depositedCheques;

  // ── Export helpers ────────────────────────────────────

  function exportInvoicesXlsx(subset: Invoice[], name: string) {
    exportToExcel(
      subset.map(inv => ({
        "Invoice No": inv.invoiceNo,
        "Shop": inv.shopName,
        "Date": formatDate(inv.invoiceDate),
        "Payment type": PAYMENT_LABELS[inv.paymentType] ?? inv.paymentType,
        "Amount (Rs)": inv.totalAmount,
      })),
      `${name}-${label.replace(/[\s/–]/g, "-")}`,
      name
    );
  }

  function exportChequesXlsx(subset: Cheque[], name: string) {
    exportToExcel(
      subset.map(c => ({
        "Shop": c.shopName,
        "Invoice": c.invoiceNo,
        "Bank": c.bank,
        "Cheque No": c.chequeNo,
        "Amount": c.amount,
        "Due Date": formatDate(c.dueDate),
        "Status": c.status,
        "Deposited": c.depositedAt ? formatDate(c.depositedAt) : "",
      })),
      `${name}-${label.replace(/[\s/–]/g, "-")}`,
      name
    );
  }

  function handlePDF() {
    if (mainTab === "invoices") {
      exportToPDF(
        `Payments Report — ${label}`, label,
        ["Invoice", "Shop", "Date", "Payment", "Amount"],
        displayedInv.map(inv => [
          inv.invoiceNo, inv.shopName,
          formatDate(inv.invoiceDate),
          PAYMENT_LABELS[inv.paymentType] ?? inv.paymentType,
          `Rs ${inv.totalAmount.toLocaleString()}`,
        ]),
        [
          { label: "Cash", value: formatLKR(cashTotal) },
          { label: "Card", value: formatLKR(cardTotal) },
          { label: "Cheque", value: formatLKR(chequeTotal) },
          { label: "Pending", value: formatLKR(pendingTotal) },
          { label: "Total", value: formatLKR(grandTotal) },
          { label: "Period", value: label },
        ]
      );
    } else {
      exportToPDF(
        `Cheques Report — ${label}`, label,
        ["Shop", "Invoice", "Bank", "Cheque No", "Amount", "Due Date", "Status"],
        displayedCheq.map(c => [
          c.shopName, c.invoiceNo, c.bank, c.chequeNo,
          `Rs ${c.amount.toLocaleString()}`,
          formatDate(c.dueDate), c.status,
        ]),
        [
          { label: "Pending", value: formatLKR(pendingCheques.reduce((s, c) => s + c.amount, 0)) },
          { label: "Overdue", value: formatLKR(overdueCheques.reduce((s, c) => s + c.amount, 0)) },
          { label: "Deposited", value: formatLKR(depositedCheques.reduce((s, c) => s + c.amount, 0)) },
          { label: "Period", value: label },
        ]
      );
    }
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-gray-800">Payments — {label}</h2>
          {!loading && (
            <p className="text-xs text-gray-400 mt-0.5">
              {invoices.length} invoices · {cheques.length} cheques
            </p>
          )}
        </div>
        <PeriodSelector
          value={range} onChange={setRange}
          customFrom={customFrom} customTo={customTo}
          onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
        />
      </div>

      {/* Summary cards — clickable to filter */}
      {!loading && invoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { emoji: "💵", label: "Cash", value: cashTotal, count: cashInv.length, tab: "invoices" as MainTab, filter: "cash" as InvoiceFilter },
            { emoji: "💳", label: "Card", value: cardTotal, count: cardInv.length, tab: "invoices" as MainTab, filter: "card" as InvoiceFilter },
            { emoji: "🏦", label: "Cheque", value: chequeTotal, count: chequeInv.length, tab: "cheques" as MainTab, filter: "all" as InvoiceFilter },
            { emoji: "⏳", label: "Pending", value: pendingTotal, count: pendingInv.length, tab: "invoices" as MainTab, filter: "pending" as InvoiceFilter },
          ].map(item => (
            <Card key={item.label} className="text-center">
              <div
                className="h-full w-full cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => {
                  setMainTab(item.tab);
                  if (item.tab === "invoices") setInvFilter(item.filter);
                }}
              >
                <p className="text-sm mb-1">{item.emoji}</p>
                <p className="text-base font-semibold text-gray-900 truncate">
                  {formatLKR(item.value)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{item.label} · {item.count}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Main tab switcher */}
      <div className="flex gap-1.5 rounded-xl bg-gray-50 p-1">
        <button onClick={() => setMainTab("invoices")}
          className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors border",
            mainTab === "invoices"
              ? "bg-white text-gray-900 border-brand-500"
              : "bg-transparent text-gray-500 border-transparent hover:text-gray-700")}>
          Invoices by payment
        </button>
        <button onClick={() => setMainTab("cheques")}
          className={cn("flex-1 rounded-lg py-2 text-sm font-medium transition-colors border",
            mainTab === "cheques"
              ? "bg-white text-gray-900 border-brand-500"
              : "bg-transparent text-gray-500 border-transparent hover:text-gray-700")}>
          Cheques Tracker
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {!loading && mainTab === "invoices" && (
        <>
          {/* Filter + export row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="overflow-x-auto scrollbar-none flex-1 min-w-0">
              <div className="flex gap-2 min-w-max">
                {([
                  { value: "all", label: "All", count: invoices.length },
                  { value: "cash", label: "💵 Cash", count: cashInv.length },
                  { value: "card", label: "💳 Card", count: cardInv.length },
                  { value: "cheque", label: "🏦 Cheque", count: chequeInv.length },
                  { value: "pending", label: "⏳ Pending", count: pendingInv.length },
                ] as { value: InvoiceFilter; label: string; count: number }[]).map(f => (
                  <button key={f.value} onClick={() => setInvFilter(f.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                      invFilter === f.value
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    )}>
                    {f.label}
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      invFilter === f.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    )}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
            {canExport && displayedInv.length > 0 && (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => exportInvoicesXlsx(displayedInv, `${invFilter}-payments`)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Excel
                </button>
                <button onClick={handlePDF}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5 text-red-500" /> PDF
                </button>
              </div>
            )}
          </div>

          {displayedInv.length === 0 ? (
            <Card className="flex flex-col items-center py-12 text-center">
              <CreditCard className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No payments in this period</p>
            </Card>
          ) : (
            <Card padding={false}>
              {displayedInv.map((inv, i) => (
                <div key={inv.id}
                  className={cn("flex items-center gap-3 px-4 py-3",
                    i < displayedInv.length - 1 && "border-b border-gray-50")}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.shopName}</p>
                      <Badge variant={paymentBadge(inv.paymentType)}>
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
                  Total ({displayedInv.length} invoices)
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatLKR(displayedInv.reduce((s, i) => s + i.totalAmount, 0))}
                </p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── CHEQUES TAB ── */}
      {!loading && mainTab === "cheques" && (
        <>
          {/* Cheque summary */}
          {cheques.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <p className="text-lg font-semibold text-amber-700">{pendingCheques.length}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {formatLKR(pendingCheques.reduce((s, c) => s + c.amount, 0))}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Pending...</p>
              </Card>
              <Card className="text-center">
                <p className="text-lg font-semibold text-red-700">{overdueCheques.length}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {formatLKR(overdueCheques.reduce((s, c) => s + c.amount, 0))}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Overdue</p>
              </Card>
              <Card className="text-center">
                <p className="text-lg font-semibold text-green-700">{depositedCheques.length}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {formatLKR(depositedCheques.reduce((s, c) => s + c.amount, 0))}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">Deposited</p>
              </Card>
            </div>
          )}

          {/* Filter + export row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="overflow-x-auto scrollbar-none flex-1 min-w-0">
              <div className="flex gap-2 min-w-max">
                {([
                  { value: "all", label: "All", count: cheques.length },
                  { value: "pending", label: "Pending", count: pendingCheques.length },
                  { value: "overdue", label: "⚠ Overdue", count: overdueCheques.length },
                  { value: "deposited", label: "Deposited", count: depositedCheques.length },
                ] as { value: ChequeFilter; label: string; count: number }[]).map(f => (
                  <button key={f.value} onClick={() => setCheqFilter(f.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0",
                      cheqFilter === f.value
                        ? f.value === "overdue"
                          ? "bg-red-600 text-white border-red-600"
                          : "bg-brand-600 text-white border-brand-600"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    )}>
                    {f.label}
                    <span className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      cheqFilter === f.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                    )}>{f.count}</span>
                  </button>
                ))}
              </div>
            </div>
            {canExport && displayedCheq.length > 0 && (
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => exportChequesXlsx(displayedCheq, `cheques-${cheqFilter}`)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" /> Excel
                </button>
                <button onClick={handlePDF}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="h-3.5 w-3.5 text-red-500" /> PDF
                </button>
              </div>
            )}
          </div>

          {displayedCheq.length === 0 ? (
            <Card className="flex flex-col items-center py-12 text-center">
              <CalendarClock className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No cheques in this period</p>
            </Card>
          ) : (
            <Card padding={false}>
              {displayedCheq.map((c, i) => {
                const due = toDate(c.dueDate) ?? new Date();
                const isOverdue = c.status === "pending" && due < now;
                const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
                return (
                  <div key={c.id}
                    className={cn("flex items-start gap-3 px-4 py-3",
                      i < displayedCheq.length - 1 && "border-b border-gray-50")}>
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
                    <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                      {formatLKR(c.amount)}
                    </p>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-b-2xl border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700">
                  Total ({displayedCheq.length} cheques)
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatLKR(displayedCheq.reduce((s, c) => s + c.amount, 0))}
                </p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}