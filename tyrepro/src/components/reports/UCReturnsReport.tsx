"use client";

import { useEffect, useState } from "react";
import { query, getDocs, orderBy, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import { RotateCcw, AlertTriangle, FileSpreadsheet, Download } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { cn } from "@/lib/utils";
import { Timestamp } from "firebase/firestore";
import type { UCReturn, UCReturnStatus } from "@/types";

function daysSince(ts: Timestamp | undefined) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86_400_000);
}

const STATUS_LABELS: Record<UCReturnStatus, string> = {
  approved: "Approved",
  sent_to_supplier: "Sent to CEAT",
  awaiting_replacement: "Awaiting replacement",
  closed: "Closed",
};

const STATUS_VARIANT: Record<UCReturnStatus, "warning" | "info" | "default" | "success"> = {
  approved: "warning",
  sent_to_supplier: "info",
  awaiting_replacement: "default",
  closed: "success",
};

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge: "Sidewall bulge",
  tread_separation: "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage: "Bead damage",
  other: "Other",
};

export default function UCReturnsReport() {
  const { appUser } = useAuth();
  const [returns, setReturns] = useState<UCReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | UCReturnStatus>("all");
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "ucReturns"), orderBy("createdAt", "desc")));
        setReturns(snap.docs.map(d => ({ id: d.id, ...d.data() } as UCReturn)));
      } catch { }
      setLoading(false);
    }
    load();
  }, []);

  const active = returns.filter(r => r.status !== "closed");
  const closed = returns.filter(r => r.status === "closed");
  const withUs = returns.filter(r => r.status === "approved");
  const withCEAT = returns.filter(r => r.status === "sent_to_supplier" || r.status === "awaiting_replacement");

  const alertNotSent = returns.filter(r => r.status === "approved" && (daysSince(r.tyreReceivedAt) ?? 0) >= 3);
  const alertLongCEAT = returns.filter(r => (r.status === "sent_to_supplier" || r.status === "awaiting_replacement") && (daysSince(r.sentToSupplierAt) ?? 0) >= 30);

  const displayed = filter === "all" ? returns : returns.filter(r => r.status === filter);

  function handleExcelExport() {
    exportToExcel(
      displayed.map(r => ({
        "Shop": r.shopName,
        "City": r.shopCity,
        "Tyre": r.productName,
        "Qty": r.qty,
        "Return Value (Rs)": (r as any).totalValue ?? 0,
        "Reason": REASON_LABELS[r.reason] ?? r.reason,
        "Status": STATUS_LABELS[r.status],
        "Replacement Given": r.gaveTyreToShop ? "Yes" : "No",
        "Received At": r.tyreReceivedAt ? formatDate(r.tyreReceivedAt) : "—",
        "Sent to CEAT": r.sentToSupplierAt ? formatDate(r.sentToSupplierAt) : "—",
        "Replacement Received": r.replacementReceivedAt ? formatDate(r.replacementReceivedAt) : "—",
        "Days with us": r.tyreReceivedAt ? String(daysSince(r.tyreReceivedAt) ?? "—") : "—",
        "Days with CEAT": r.sentToSupplierAt ? String(daysSince(r.sentToSupplierAt) ?? "—") : "—",
      })),
      `UC-Returns-${filter}`,
      "UC Returns"
    );
  }

  function handlePDFExport() {
    const totalValue = displayed.reduce((s, r) => s + ((r as any).totalValue ?? 0), 0);
    exportToPDF(
      "UC Returns Report",
      filter === "all" ? "All returns" : STATUS_LABELS[filter as UCReturnStatus],
      ["Shop", "Tyre", "Qty", "Value", "Reason", "Status", "Given", "Days with us", "Days CEAT"],
      displayed.map(r => [
        r.shopName, r.productName, r.qty,
        `Rs ${((r as any).totalValue ?? 0).toLocaleString()}`,
        REASON_LABELS[r.reason] ?? r.reason,
        STATUS_LABELS[r.status],
        r.gaveTyreToShop ? "Yes" : "No",
        r.tyreReceivedAt ? String(daysSince(r.tyreReceivedAt) ?? "—") : "—",
        r.sentToSupplierAt ? String(daysSince(r.sentToSupplierAt) ?? "—") : "—",
      ]),
      [
        { label: "Active returns", value: String(active.length) },
        { label: "Closed", value: String(closed.length) },
        { label: "With us", value: String(withUs.length) },
        { label: "With CEAT", value: String(withCEAT.length) },
        { label: "Total value", value: `Rs ${totalValue.toLocaleString()}` },
      ]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-base font-medium text-gray-800">UC returns summary</h2>
        {isAdmin && !loading && displayed.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleExcelExport} className="gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
            </Button>
            <Button size="sm" variant="secondary" onClick={handlePDFExport} className="gap-1.5">
              <Download className="h-4 w-4 text-red-500" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center py-3 min-w-0"><p className="text-2xl font-semibold text-amber-700">{active.length}</p><p className="text-xs text-gray-500 mt-0.5">Active returns</p></Card>
        <Card className="text-center py-3 min-w-0"><p className="text-2xl font-semibold text-green-700">{closed.length}</p><p className="text-xs text-gray-500 mt-0.5">Closed</p></Card>
        <Card className="text-center py-3 min-w-0"><p className="text-2xl font-semibold text-brand-700">{withUs.length}</p><p className="text-xs text-gray-500 mt-0.5">Tyres with us</p></Card>
        <Card className="text-center py-3 min-w-0"><p className="text-2xl font-semibold text-blue-700">{withCEAT.length}</p><p className="text-xs text-gray-500 mt-0.5">With CEAT</p></Card>
      </div>

      {alertNotSent.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-amber-600" /><p className="text-sm font-medium text-amber-800">Not sent to CEAT (3+ days)</p></div>
          {alertNotSent.map(r => <p key={r.id} className="text-xs text-amber-900 ml-6">{r.shopName} — {r.productName} · {daysSince(r.tyreReceivedAt)}d with you</p>)}
        </Card>
      )}
      {alertLongCEAT.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-red-600" /><p className="text-sm font-medium text-red-800">With CEAT 30+ days — follow up!</p></div>
          {alertLongCEAT.map(r => <p key={r.id} className="text-xs text-red-900 ml-6">{r.shopName} — {r.productName} · sent {daysSince(r.sentToSupplierAt)}d ago</p>)}
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { value: "all", label: `All (${returns.length})` },
          { value: "approved", label: `Approved (${withUs.length})` },
          { value: "sent_to_supplier", label: `Sent CEAT (${withCEAT.length})` },
          { value: "awaiting_replacement", label: `Awaiting (${returns.filter(r => r.status === "awaiting_replacement").length})` },
          { value: "closed", label: `Closed (${closed.length})` },
        ] as const).map(f => (
          <button key={f.value} onClick={() => setFilter(f.value as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${filter === f.value ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-8"><div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}
      {!loading && displayed.length === 0 && <Card className="py-8 text-center text-sm text-gray-400">No returns found</Card>}

      <div className="space-y-2">
        {displayed.map(r => (
          <Card key={r.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.shopName}</p>
                  <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{r.qty}× {r.productName} · Rs {((r as any).totalValue ?? 0).toLocaleString()}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span className={cn(r.gaveTyreToShop ? "text-green-700" : "text-red-600")}>
                    {r.gaveTyreToShop ? "✓ Replacement given" : "✗ Replacement not given"}
                  </span>
                  {r.tyreReceivedAt && <span>Received {daysSince(r.tyreReceivedAt)}d ago</span>}
                  {r.sentToSupplierAt && <span>Sent CEAT {daysSince(r.sentToSupplierAt)}d ago</span>}
                  {r.replacementReceivedAt && <span className="text-green-700">CEAT: {formatDate(r.replacementReceivedAt)}</span>}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}