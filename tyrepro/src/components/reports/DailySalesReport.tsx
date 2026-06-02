"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, getDocs,
  orderBy, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate } from "@/lib/utils";
import { TrendingUp, FileText, CreditCard, Banknote, Download, FileSpreadsheet } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import type { Invoice } from "@/types";

function getDateRange(range: string): { start: Date; end: Date; label: string } {
  const now   = new Date();
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);

  if (range === "today")     return { start, end, label: "Today" };
  if (range === "week")  { start.setDate(now.getDate() - 6); start.setHours(0,0,0,0); return { start, end, label: "Last 7 days" }; }
  if (range === "month") { start.setDate(1); start.setHours(0,0,0,0); return { start, end, label: "This month" }; }
  start.setMonth(now.getMonth() - 1, 1); start.setHours(0,0,0,0);
  end.setDate(0); end.setHours(23,59,59,999);
  return { start, end, label: "Last month" };
}

export default function DailySalesReport() {
  const { appUser }              = useAuth();
  const [range, setRange]        = useState("today");
  const [invoices, setInvoices]  = useState<Invoice[]>([]);
  const [loading, setLoading]    = useState(true);
  const isAdmin                  = appUser?.role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { start, end } = getDateRange(range);
      try {
        const snap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(start)),
          where("invoiceDate", "<=", Timestamp.fromDate(end)),
          orderBy("invoiceDate", "desc")
        ));
        setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
      } catch {}
      setLoading(false);
    }
    load();
  }, [range]);

  const { label }   = getDateRange(range);
  const totalSales  = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const cashSales   = invoices.filter(i => i.paymentType === "cash").reduce((s, i) => s + i.totalAmount, 0);
  const chequeSales = invoices.filter(i => i.paymentType !== "cash").reduce((s, i) => s + i.totalAmount, 0);

  const byDate: Record<string, Invoice[]> = {};
  invoices.forEach(inv => {
    const d = formatDate(inv.invoiceDate, "dd MMM yyyy");
    byDate[d] = [...(byDate[d] ?? []), inv];
  });

  function handleExcelExport() {
    const rows = invoices.map(inv => ({
      "Invoice No":     inv.invoiceNo,
      "Shop":           inv.shopName,
      "Date":           formatDate(inv.invoiceDate, "dd MMM yyyy"),
      "Payment":        inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_","Cheque ").replace("d"," days"),
      "Amount (Rs)":    inv.totalAmount,
      "Warehouse":      inv.warehouseName,
    }));
    exportToExcel(rows, `Daily-Sales-${label.replace(/\s/g,"-")}`, "Daily Sales");
  }

  function handlePDFExport() {
    exportToPDF(
      "Daily Sales Report",
      label,
      ["Invoice No", "Shop", "Date", "Payment", "Amount (Rs)", "Warehouse"],
      invoices.map(inv => [
        inv.invoiceNo,
        inv.shopName,
        formatDate(inv.invoiceDate, "dd MMM yyyy"),
        inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_","Cheque ").replace("d"," days"),
        `Rs ${inv.totalAmount.toLocaleString()}`,
        inv.warehouseName,
      ]),
      [
        { label: "Total Sales",   value: formatLKR(totalSales)  },
        { label: "Cash Sales",    value: formatLKR(cashSales)   },
        { label: "Cheque Sales",  value: formatLKR(chequeSales) },
        { label: "Total Invoices",value: String(invoices.length)},
      ]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-medium text-gray-800">Sales — {label}</h2>
        <div className="flex items-center gap-2">
          {isAdmin && !loading && invoices.length > 0 && (
            <>
              <Button size="sm" variant="secondary" onClick={handleExcelExport} className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
              </Button>
              <Button size="sm" variant="secondary" onClick={handlePDFExport} className="gap-1.5">
                <Download className="h-4 w-4 text-red-500" /> PDF
              </Button>
            </>
          )}
          <Select value={range} onChange={e => setRange(e.target.value)} className="w-36"
            options={[
              { value: "today",     label: "Today"       },
              { value: "week",      label: "Last 7 days" },
              { value: "month",     label: "This month"  },
              { value: "lastmonth", label: "Last month"  },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-50 p-2.5 flex-shrink-0"><TrendingUp className="h-5 w-5 text-brand-600" /></div>
          <div><p className="text-xs text-gray-500">Total sales</p><p className="text-lg font-semibold text-gray-900">{loading ? "—" : formatLKR(totalSales)}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2.5 flex-shrink-0"><FileText className="h-5 w-5 text-gray-600" /></div>
          <div><p className="text-xs text-gray-500">Invoices</p><p className="text-lg font-semibold text-gray-900">{loading ? "—" : invoices.length}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-green-50 p-2.5 flex-shrink-0"><Banknote className="h-5 w-5 text-green-600" /></div>
          <div><p className="text-xs text-gray-500">Cash sales</p><p className="text-lg font-semibold text-gray-900">{loading ? "—" : formatLKR(cashSales)}</p></div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 flex-shrink-0"><CreditCard className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-xs text-gray-500">Cheque sales</p><p className="text-lg font-semibold text-gray-900">{loading ? "—" : formatLKR(chequeSales)}</p></div>
        </Card>
      </div>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}
      {!loading && invoices.length === 0 && <Card className="py-10 text-center text-sm text-gray-400">No sales in this period</Card>}

      {!loading && Object.entries(byDate).map(([date, invs]) => (
        <Card key={date} padding={false}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50 rounded-t-2xl">
            <span className="text-sm font-medium text-gray-700">{date}</span>
            <span className="text-sm font-medium text-gray-900">{formatLKR(invs.reduce((s,i) => s+i.totalAmount,0))} · {invs.length} invoices</span>
          </div>
          {invs.map((inv, i) => (
            <div key={inv.id} className={`flex items-center justify-between px-4 py-3 ${i < invs.length-1 ? "border-b border-gray-50" : ""}`}>
              <div>
                <p className="text-sm font-medium text-gray-900">{inv.shopName}</p>
                <p className="text-xs text-gray-400">{inv.invoiceNo} · {inv.paymentType === "cash" ? "Cash" : inv.paymentType.replace("cheque_","Cheque ").replace("d"," days")}</p>
              </div>
              <span className="text-sm font-medium text-gray-900">{formatLKR(inv.totalAmount)}</span>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}