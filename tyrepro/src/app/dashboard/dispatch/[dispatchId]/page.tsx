"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc, getDoc, onSnapshot, updateDoc,
  serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dispatchesCol, dispatchStopsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft, Truck, CheckCircle, XCircle,
  Clock, MapPin, Package, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { Dispatch, DispatchStop, DispatchStatus } from "@/types";

// ── Status helpers ────────────────────────────────────────

const DISPATCH_STATUS: Record<DispatchStatus, { label: string; variant: "default"|"info"|"success"|"danger" }> = {
  planned:     { label: "Planned",     variant: "default" },
  in_progress: { label: "In progress", variant: "info"    },
  completed:   { label: "Completed",   variant: "success" },
  cancelled:   { label: "Cancelled",   variant: "danger"  },
};

function stopStatusIcon(status: string) {
  if (status === "delivered") return <CheckCircle className="h-5 w-5 text-green-500" />;
  if (status === "skipped")   return <XCircle className="h-5 w-5 text-red-400" />;
  return <Clock className="h-5 w-5 text-gray-300" />;
}

// ── Skip reason modal ─────────────────────────────────────

function SkipModal({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("Shop closed");
  const [custom, setCustom] = useState("");
  const reasons = ["Shop closed", "Owner not available", "Road issue", "Other"];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <Card className="w-full max-w-sm rounded-t-3xl md:rounded-2xl">
        <CardHeader title="Skip reason" subtitle="Why is this stop being skipped?" />
        <div className="space-y-2 mb-4">
          {reasons.map(r => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "w-full rounded-xl border px-4 py-2.5 text-sm text-left transition-colors",
                reason === r ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-700"
              )}
            >
              {r}
            </button>
          ))}
          {reason === "Other" && (
            <input
              autoFocus
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
              placeholder="Describe reason..."
              value={custom}
              onChange={e => setCustom(e.target.value)}
            />
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={() => onConfirm(reason === "Other" ? custom || "Other" : reason)}>
            Skip stop
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const { appUser }    = useAuth();
  const router         = useRouter();

  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [stops, setStops]       = useState<DispatchStop[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [skipStop, setSkipStop] = useState<DispatchStop | null>(null);

  // Load dispatch doc
  useEffect(() => {
    const unsub = onSnapshot(doc(dispatchesCol, dispatchId), snap => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Dispatch, "id">;
        setDispatch({ ...data, id: snap.id });
      }
      setLoading(false);
    });
    return unsub;
  }, [dispatchId]);

  // Load stops (real-time so driver updates visible immediately)
  useEffect(() => {
    const q   = query(dispatchStopsCol(dispatchId), orderBy("stopOrder"));
    const unsub = onSnapshot(q, snap => {
      setStops(snap.docs.map(d => {
        const data = d.data() as Omit<DispatchStop, "id">;
        return { ...data, id: d.id } as DispatchStop;
      }));
    });
    return unsub;
  }, [dispatchId]);

  // ── Actions ───────────────────────────────────────────────

  async function startDispatch() {
    setActing("start");
    await updateDoc(doc(dispatchesCol, dispatchId), {
      status: "in_progress",
      updatedAt: serverTimestamp(),
    });
    setActing(null);
  }

  async function markDelivered(stop: DispatchStop) {
    setActing(stop.id);
    try {
      await updateDoc(doc(dispatchStopsCol(dispatchId), stop.id), {
        status:      "delivered",
        deliveredAt: serverTimestamp(),
      });
      // Check if all stops done → auto-complete dispatch
      const allDone = stops.every(s =>
        s.id === stop.id ? true : s.status !== "pending"
      );
      if (allDone) {
        await updateDoc(doc(dispatchesCol, dispatchId), {
          status:      "completed",
          completedAt: serverTimestamp(),
        });
      }
    } finally {
      setActing(null);
    }
  }

  async function markSkipped(stop: DispatchStop, reason: string) {
    setActing(stop.id);
    setSkipStop(null);
    try {
      await updateDoc(doc(dispatchStopsCol(dispatchId), stop.id), {
        status:        "skipped",
        skippedReason: reason,
        deliveredAt:   serverTimestamp(),
      });
      const allDone = stops.every(s =>
        s.id === stop.id ? true : s.status !== "pending"
      );
      if (allDone) {
        await updateDoc(doc(dispatchesCol, dispatchId), {
          status:      "completed",
          completedAt: serverTimestamp(),
        });
      }
    } finally {
      setActing(null);
    }
  }

  // ── Computed ──────────────────────────────────────────────

  const delivered   = stops.filter(s => s.status === "delivered").length;
  const skipped     = stops.filter(s => s.status === "skipped").length;
  const pending     = stops.filter(s => s.status === "pending").length;
  const progressPct = stops.length > 0 ? Math.round(((delivered + skipped) / stops.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!dispatch) {
    return <div className="p-6 text-sm text-gray-500">Dispatch not found.</div>;
  }

  const statusMeta = DISPATCH_STATUS[dispatch.status];

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto pb-24">
      {/* Back + title */}
      <div className="mb-5 flex items-center gap-3">
        <Link href="/dashboard/dispatch">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50">
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-medium text-gray-900">{dispatch.lorryReg}</h1>
            <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
          </div>
          <p className="text-xs text-gray-400">
            {dispatch.fromWarehouseName} · {formatDate(dispatch.dispatchDate)}
          </p>
        </div>
      </div>

      {/* Progress card */}
      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-4 text-sm">
            <span><span className="font-medium text-green-600">{delivered}</span> <span className="text-gray-500">delivered</span></span>
            <span><span className="font-medium text-red-500">{skipped}</span> <span className="text-gray-500">skipped</span></span>
            <span><span className="font-medium text-gray-500">{pending}</span> <span className="text-gray-400">pending</span></span>
          </div>
          <span className="text-sm font-medium text-gray-700">{progressPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-gray-500">
          <span>{dispatch.totalStops} stops · {dispatch.totalUnits} tyres</span>
          {dispatch.lorryModel && <span>{dispatch.lorryModel}</span>}
        </div>
      </Card>

      {/* Start dispatch button — admin only */}
      {dispatch.status === "planned" && (
        <Card className="mb-4 bg-brand-50 border-brand-200">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-brand-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-brand-900">Ready to start?</p>
              <p className="text-xs text-brand-700">Driver can mark stops once dispatch is started</p>
            </div>
            <Button size="sm" loading={acting === "start"} onClick={startDispatch}>
              Start
            </Button>
          </div>
        </Card>
      )}

      {/* Completed summary */}
      {dispatch.status === "completed" && (
        <Card className="mb-4 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-900">Dispatch completed</p>
              <p className="text-xs text-green-700">
                {delivered} delivered · {skipped} skipped
                {dispatch.completedAt && ` · ${formatDate(dispatch.completedAt)}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stops list */}
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Delivery stops</h2>

      <div className="space-y-3">
        {stops.map(stop => (
          <Card
            key={stop.id}
            className={cn(
              "border-l-4",
              stop.status === "delivered" ? "border-l-green-400" :
              stop.status === "skipped"   ? "border-l-red-300"   : "border-l-gray-200"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Status icon */}
              <div className="mt-0.5">{stopStatusIcon(stop.status)}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400">#{stop.stopOrder}</span>
                  <p className="text-sm font-medium text-gray-900">{stop.shopName}</p>
                  <span className="text-xs text-gray-400">{stop.shopCity}</span>
                </div>

                {/* Items */}
                <div className="mt-2 space-y-0.5">
                  {stop.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                      <Package className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span>{item.qty}× {item.productName}</span>
                    </div>
                  ))}
                </div>

                {/* Status details */}
                {stop.status === "delivered" && stop.deliveredAt && (
                  <p className="mt-2 text-xs text-green-700">
                    ✓ Delivered · {formatDate(stop.deliveredAt, "dd MMM · hh:mm a")}
                  </p>
                )}
                {stop.status === "skipped" && (
                  <p className="mt-2 text-xs text-red-600">
                    Skipped — {stop.skippedReason}
                  </p>
                )}

                {/* Action buttons — shown only when in_progress and stop is pending */}
                {dispatch.status === "in_progress" && stop.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      loading={acting === stop.id}
                      onClick={() => markDelivered(stop)}
                      className="gap-1.5"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark delivered
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSkipStop(stop)}
                      className="gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Skip modal */}
      {skipStop && (
        <SkipModal
          onConfirm={reason => markSkipped(skipStop, reason)}
          onCancel={() => setSkipStop(null)}
        />
      )}
    </div>
  );
}
