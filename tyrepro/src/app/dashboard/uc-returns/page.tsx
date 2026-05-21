"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  query, orderBy, onSnapshot, doc,
  updateDoc, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ucReturnsCol, stockCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import {
  Plus, RotateCcw, PackageCheck, Send,
  Clock, CheckCircle, AlertTriangle, Truck,
} from "lucide-react";
import type { UCReturn, UCReturnStatus } from "@/types";
import { Timestamp } from "firebase/firestore";

// ── helpers ──────────────────────────────────────────────

function daysSince(ts: Timestamp | undefined): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86_400_000);
}

function daysLabel(days: number | null, prefix: string): string {
  if (days === null) return "";
  if (days === 0) return `${prefix} today`;
  return `${prefix} ${days}d ago`;
}

const STATUS_META: Record<UCReturnStatus, { label: string; color: string; icon: React.ElementType }> = {
  approved:             { label: "Approved — tyre with us",     color: "warning", icon: PackageCheck },
  sent_to_supplier:     { label: "Sent to CEAT",                color: "info",    icon: Send         },
  awaiting_replacement: { label: "Waiting for CEAT replacement", color: "warning", icon: Clock        },
  closed:               { label: "Closed — replacement received", color: "success", icon: CheckCircle  },
};

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge:       "Sidewall bulge",
  tread_separation:     "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage:          "Bead damage",
  other:                "Other",
};

// ── Status timeline bar ───────────────────────────────────

function StatusTimeline({ uc }: { uc: UCReturn }) {
  const steps = [
    {
      key: "received",
      label: "Tyre received",
      done: uc.tyreReceivedFromShop,
      date: uc.tyreReceivedAt,
    },
    {
      key: "sent",
      label: "Sent to CEAT",
      done: !!uc.sentToSupplierAt,
      date: uc.sentToSupplierAt,
    },
    {
      key: "replacement",
      label: "Replacement received",
      done: !!uc.replacementReceivedAt,
      date: uc.replacementReceivedAt,
    },
  ];

  return (
    <div className="mt-3 flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={cn(
              "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              step.done
                ? "border-green-500 bg-green-500"
                : "border-gray-300 bg-white"
            )}>
              {step.done && <CheckCircle className="h-3 w-3 text-white" />}
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{step.label}</p>
            {step.date && (
              <p className="text-[10px] text-gray-400 text-center">
                {daysLabel(daysSince(step.date), "·")}
              </p>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              "h-0.5 w-8 flex-shrink-0 mx-1 mb-5",
              step.done ? "bg-green-400" : "bg-gray-200"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Alert flags ───────────────────────────────────────────

function UrgencyFlag({ uc }: { uc: UCReturn }) {
  const daysWithUs   = daysSince(uc.tyreReceivedAt);
  const daysSentCEAT = daysSince(uc.sentToSupplierAt);

  if (uc.status === "approved" && uc.tyreReceivedFromShop && daysWithUs !== null && daysWithUs >= 3) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Tyre with you for <span className="font-medium">{daysWithUs} days</span> — not yet sent to CEAT
        </p>
      </div>
    );
  }
  if (uc.status === "awaiting_replacement" && daysSentCEAT !== null && daysSentCEAT >= 30) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
        <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
        <p className="text-xs text-red-800">
          Sent to CEAT <span className="font-medium">{daysSentCEAT} days ago</span> — follow up!
        </p>
      </div>
    );
  }
  return null;
}

// ── Action buttons per status ─────────────────────────────

function ActionButtons({ uc, onRefresh }: { uc: UCReturn; onRefresh: () => void }) {
  const { appUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function doUpdate(fields: Partial<UCReturn> & { status?: UCReturnStatus }) {
    setLoading(fields.status ?? "update");
    try {
      await updateDoc(doc(ucReturnsCol, uc.id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
      onRefresh();
    } finally {
      setLoading(null);
    }
  }

  async function markReplacementReceived() {
    setLoading("closed");
    try {
      // Increment stock in the warehouse
      const stockDocId = `${uc.warehouseId}_${uc.productId}`;
      await updateDoc(doc(stockCol, stockDocId), {
        qty: increment(uc.qty),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(ucReturnsCol, uc.id), {
        status: "closed",
        replacementReceivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onRefresh();
    } finally {
      setLoading(null);
    }
  }

  if (uc.status === "approved") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {!uc.tyreReceivedFromShop && (
          <Button size="sm" variant="secondary" loading={loading === "received"}
            onClick={() => doUpdate({ tyreReceivedFromShop: true, tyreReceivedAt: serverTimestamp() as any })}>
            Mark tyre received from shop
          </Button>
        )}
        {uc.tyreReceivedFromShop && (
          <Button size="sm" loading={loading === "sent_to_supplier"}
            onClick={() => doUpdate({ status: "sent_to_supplier", sentToSupplierAt: serverTimestamp() as any })}>
            Mark sent to CEAT
          </Button>
        )}
      </div>
    );
  }

  if (uc.status === "sent_to_supplier") {
    return (
      <div className="mt-3">
        <Button size="sm" variant="secondary" loading={loading === "awaiting_replacement"}
          onClick={() => doUpdate({ status: "awaiting_replacement" })}>
          Confirm CEAT acknowledged
        </Button>
      </div>
    );
  }

  if (uc.status === "awaiting_replacement") {
    return (
      <div className="mt-3">
        <Button size="sm" loading={loading === "closed"} onClick={markReplacementReceived}>
          Mark replacement received from CEAT
        </Button>
      </div>
    );
  }

  return null;
}

// ── UC Return Card ────────────────────────────────────────

function UCReturnCard({ uc, onRefresh }: { uc: UCReturn; onRefresh: () => void }) {
  const meta       = STATUS_META[uc.status];
  const StatusIcon = meta.icon;
  const daysWithUs  = uc.tyreReceivedFromShop ? daysSince(uc.tyreReceivedAt) : null;
  const daysSent    = uc.sentToSupplierAt ? daysSince(uc.sentToSupplierAt) : null;

  return (
    <Card className="mb-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{uc.shopName}</p>
            <span className="text-xs text-gray-400">{uc.shopCity}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {uc.qty}× {uc.productName} · {REASON_LABELS[uc.reason] ?? uc.reason}
          </p>
          <p className="text-xs text-gray-400">{uc.warehouseName} warehouse</p>
        </div>
        <Badge variant={meta.color as any}>
          <StatusIcon className="h-3 w-3 mr-1" />
          {meta.label}
        </Badge>
      </div>

      {/* Key info chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Gave tyre to shop? */}
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
          uc.gaveTyreToShop
            ? "bg-green-50 text-green-800"
            : "bg-red-50 text-red-700"
        )}>
          <PackageCheck className="h-3 w-3" />
          {uc.gaveTyreToShop
            ? `New tyre given to shop${uc.gaveTyreToShopAt ? ` · ${daysLabel(daysSince(uc.gaveTyreToShopAt), "")}` : ""}`
            : "New tyre NOT yet given to shop"}
        </span>

        {/* Days with us */}
        {uc.tyreReceivedFromShop && daysWithUs !== null && uc.status === "approved" && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            daysWithUs >= 3 ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-700"
          )}>
            <Clock className="h-3 w-3" />
            With us {daysWithUs}d — not sent to CEAT yet
          </span>
        )}

        {/* Days since sent to CEAT */}
        {daysSent !== null && (uc.status === "sent_to_supplier" || uc.status === "awaiting_replacement") && (
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            daysSent >= 30 ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-800"
          )}>
            <Send className="h-3 w-3" />
            Sent to CEAT {daysSent}d ago
          </span>
        )}

        {/* Replacement received */}
        {uc.status === "closed" && uc.replacementReceivedAt && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-green-50 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Replacement received · {daysLabel(daysSince(uc.replacementReceivedAt), "")} ago
          </span>
        )}
      </div>

      {/* Status timeline */}
      <StatusTimeline uc={uc} />

      {/* Urgency alert */}
      <UrgencyFlag uc={uc} />

      {/* Action buttons */}
      <ActionButtons uc={uc} onRefresh={() => {}} />
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────

type TabKey = "active" | "closed";

export default function UCReturnsPage() {
  const [returns, setReturns] = useState<UCReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<TabKey>("active");
  const [tick, setTick]       = useState(0); // force refresh

  useEffect(() => {
    const q = tab === "active"
      ? query(ucReturnsCol, orderBy("createdAt", "desc"))
      : query(ucReturnsCol, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ ...d.data(), id: d.id } as UCReturn));
      setReturns(
        tab === "active"
          ? all.filter(r => r.status !== "closed")
          : all.filter(r => r.status === "closed")
      );
      setLoading(false);
    });
    return unsub;
  }, [tab, tick]);

  // Summary counts
  const withUs         = returns.filter(r => r.status === "approved" && r.tyreReceivedFromShop).length;
  const notReceivedYet = returns.filter(r => r.status === "approved" && !r.tyreReceivedFromShop).length;
  const withCEAT       = returns.filter(r => r.status === "sent_to_supplier" || r.status === "awaiting_replacement").length;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">UC Returns</h1>
          <p className="text-sm text-gray-500">Track defective tyre returns</p>
        </div>
        <Link href="/dashboard/uc-returns/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Add return
          </Button>
        </Link>
      </div>

      {/* Summary stats */}
      {tab === "active" && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <Card className="text-center py-3 px-2">
            <p className="text-xl font-medium text-amber-700">{notReceivedYet}</p>
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">Not collected from shop yet</p>
          </Card>
          <Card className="text-center py-3 px-2">
            <p className="text-xl font-medium text-brand-700">{withUs}</p>
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">With us, not sent to CEAT</p>
          </Card>
          <Card className="text-center py-3 px-2">
            <p className="text-xl font-medium text-blue-700">{withCEAT}</p>
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">With CEAT waiting</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl border border-gray-200 overflow-hidden">
        {(["active", "closed"] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700"
            )}>
            {t === "active" ? "Active returns" : "Closed"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && returns.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <RotateCcw className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {tab === "active" ? "No active UC returns" : "No closed returns yet"}
          </p>
        </Card>
      )}

      {returns.map(uc => (
        <UCReturnCard key={uc.id} uc={uc} onRefresh={() => setTick(t => t + 1)} />
      ))}
    </div>
  );
}
