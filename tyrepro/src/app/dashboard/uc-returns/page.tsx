"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  query, orderBy, onSnapshot, doc,
  updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ucReturnsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { cn } from "@/lib/utils";
import {
  Plus, RotateCcw, PackageCheck, Send,
  Clock, CheckCircle, AlertTriangle, Undo2, Trash2,
} from "lucide-react";
import type { UCReturn, UCReturnStatus } from "@/types";

// ── Helpers ───────────────────────────────────────────────

function daysSince(ts: Timestamp | undefined): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86_400_000);
}

function fmtDt(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("en-LK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_META: Record<UCReturnStatus, { label: string; color: "warning"|"info"|"default"|"success"; icon: React.ElementType }> = {
  approved:             { label: "Approved — tyre with us",       color: "warning", icon: PackageCheck },
  sent_to_supplier:     { label: "Sent to CEAT",                  color: "info",    icon: Send         },
  awaiting_replacement: { label: "Waiting for CEAT replacement",  color: "default", icon: Clock        },
  closed:               { label: "Closed — replacement received", color: "success", icon: CheckCircle  },
};

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge:       "Sidewall bulge",
  tread_separation:     "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage:          "Bead damage",
  other:                "Other",
};

// ── Undo toast ────────────────────────────────────────────

interface UndoState {
  ucId: string; prevFields: Record<string, any>;
  newStatus: UCReturnStatus; message: string; countdown: number;
}

function UndoToast({ undo, onUndo, onDismiss }: {
  undo: UndoState; onUndo: () => void; onDismiss: () => void;
}) {
  useEffect(() => { if (undo.countdown <= 0) onDismiss(); }, [undo.countdown]);
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl min-w-[280px]">
      <div className="flex-1">
        <p className="text-sm font-medium">{undo.message}</p>
        <p className="text-xs text-gray-400">Auto-dismiss in {undo.countdown}s</p>
      </div>
      <button onClick={onUndo}
        className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-1.5 text-sm font-medium transition-colors">
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </button>
    </div>
  );
}

// ── Status timeline ───────────────────────────────────────

function StatusTimeline({ uc }: { uc: UCReturn }) {
  const steps = [
    { key: "received",    label: "Received from shop", done: uc.tyreReceivedFromShop,     date: uc.tyreReceivedAt        },
    { key: "sent",        label: "Sent to CEAT",        done: !!uc.sentToSupplierAt,      date: uc.sentToSupplierAt      },
    { key: "replacement", label: "Replacement back",    done: !!uc.replacementReceivedAt, date: uc.replacementReceivedAt },
  ];
  return (
    <div className="mt-4 flex items-start">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
              step.done ? "border-green-500 bg-green-500" : "border-gray-300 bg-white")}>
              {step.done && <CheckCircle className="h-3.5 w-3.5 text-white" />}
            </div>
            <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{step.label}</p>
            {step.date && <p className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{fmtDt(step.date)}</p>}
          </div>
          {i < steps.length - 1 && (
            <div className={cn("h-0.5 w-6 flex-shrink-0 mx-0.5 mt-[-16px]", step.done ? "bg-green-400" : "bg-gray-200")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Return details ────────────────────────────────────────

function ReturnDetails({ uc }: { uc: UCReturn }) {
  return (
    <div className="mt-3 rounded-xl bg-gray-50 p-3 space-y-2">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Return details</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div><p className="text-gray-400">Shop</p><p className="font-medium text-gray-900">{uc.shopName}</p><p className="text-gray-500">{uc.shopCity}</p></div>
        <div><p className="text-gray-400">Tyre</p><p className="font-medium text-gray-900">{uc.productName}</p><p className="text-gray-500">{uc.productSku}</p></div>
        <div><p className="text-gray-400">Qty returned</p><p className="font-medium text-gray-900 text-base">{uc.qty} tyre{uc.qty > 1 ? "s" : ""}</p></div>
        <div><p className="text-gray-400">Return value</p><p className="font-medium text-gray-900 text-base">Rs {((uc as any).totalValue ?? 0).toLocaleString()}</p></div>
        <div><p className="text-gray-400">Reason</p><p className="font-medium text-gray-900">{REASON_LABELS[uc.reason] ?? uc.reason}</p></div>
        {(uc as any).reasonNotes && <div><p className="text-gray-400">Notes</p><p className="font-medium text-gray-900">{(uc as any).reasonNotes}</p></div>}
        <div><p className="text-gray-400">Received at</p><p className="font-medium text-gray-900">{fmtDt(uc.tyreReceivedAt)}</p></div>
        <div>
          <p className="text-gray-400">Replacement given</p>
          <p className={cn("font-medium", uc.gaveTyreToShop ? "text-green-700" : "text-amber-700")}>
            {uc.gaveTyreToShop ? `Yes · ${fmtDt(uc.gaveTyreToShopAt)}` : "Not yet"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── UC Return Card ────────────────────────────────────────

function UCReturnCard({ uc, isAdmin, onAction, onDelete }: {
  uc: UCReturn; isAdmin: boolean;
  onAction: (ucId: string, newStatus: UCReturnStatus, fields: Record<string, any>, prevStatus: UCReturnStatus, prevFields: Record<string, any>, message: string) => void;
  onDelete: (uc: UCReturn) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[uc.status];
  const StatusIcon = meta.icon;
  const daysWithUs = daysSince(uc.tyreReceivedAt);
  const daysSent   = daysSince(uc.sentToSupplierAt);

  return (
    <Card className="mb-3">
      <div className="flex items-start gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900">{uc.shopName}</p>
                <span className="text-xs text-gray-400">{uc.shopCity}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{uc.qty}× {uc.productName} · {REASON_LABELS[uc.reason] ?? uc.reason}</p>
              <p className="text-xs text-gray-400 mt-0.5">Received: {fmtDt(uc.tyreReceivedAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Badge variant={meta.color}>
                <StatusIcon className="h-3 w-3 mr-1" />{meta.label}
              </Badge>
              <span className="text-xs text-brand-600">{expanded ? "Hide ▲" : "Details ▼"}</span>
            </div>
          </div>
        </div>

        {/* Delete button — admin only */}
        {isAdmin && (
          <button
            onClick={() => onDelete(uc)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors mt-0.5"
            title="Delete UC return"
          >
            <Trash2 className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Alerts */}
      {uc.status === "approved" && daysWithUs !== null && daysWithUs >= 3 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">Tyre with you <span className="font-medium">{daysWithUs} days</span> — not sent to CEAT</p>
        </div>
      )}
      {(uc.status === "sent_to_supplier" || uc.status === "awaiting_replacement") && daysSent !== null && daysSent >= 30 && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800">Sent to CEAT <span className="font-medium">{daysSent} days ago</span> — follow up!</p>
        </div>
      )}

      {expanded && <ReturnDetails uc={uc} />}
      <StatusTimeline uc={uc} />

      {/* Action buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        {uc.status === "approved" && (
          <Button size="sm"
            onClick={() => onAction(uc.id, "sent_to_supplier", { status: "sent_to_supplier", sentToSupplierAt: Timestamp.now() }, uc.status, { status: "approved", sentToSupplierAt: null }, "Marked as sent to CEAT")}>
            Mark sent to CEAT
          </Button>
        )}
        {uc.status === "sent_to_supplier" && (
          <Button size="sm" variant="secondary"
            onClick={() => onAction(uc.id, "awaiting_replacement", { status: "awaiting_replacement" }, uc.status, { status: "sent_to_supplier" }, "Marked CEAT acknowledged")}>
            Confirm CEAT acknowledged
          </Button>
        )}
        {uc.status === "awaiting_replacement" && (
          <Button size="sm"
            onClick={() => onAction(uc.id, "closed", { status: "closed", replacementReceivedAt: Timestamp.now() }, uc.status, { status: "awaiting_replacement", replacementReceivedAt: null }, "Marked replacement received")}>
            Mark replacement received from CEAT
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── Summary ───────────────────────────────────────────────

function SummarySection({ returns }: { returns: UCReturn[] }) {
  const totalQty   = returns.reduce((s, r) => s + r.qty, 0);
  const totalValue = returns.reduce((s, r) => s + ((r as any).totalValue ?? 0), 0);
  const withUs     = returns.filter(r => r.status === "approved").length;
  const withCEAT   = returns.filter(r => r.status === "sent_to_supplier" || r.status === "awaiting_replacement").length;
  const notGiven   = returns.filter(r => !r.gaveTyreToShop).length;

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 bg-white overflow-hidden">
      <div className="px-4 py-3 bg-brand-600 text-white">
        <p className="text-sm font-medium">Active UC returns summary</p>
        <p className="text-xs text-brand-200 mt-0.5">{returns.length} returns · {totalQty} tyres · Rs {totalValue.toLocaleString()} total value</p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="px-3 py-3 text-center"><p className="text-xl font-semibold text-brand-700">{withUs}</p><p className="text-[11px] text-gray-500 mt-0.5">With us</p></div>
        <div className="px-3 py-3 text-center"><p className="text-xl font-semibold text-blue-700">{withCEAT}</p><p className="text-[11px] text-gray-500 mt-0.5">With CEAT</p></div>
        <div className="px-3 py-3 text-center"><p className={cn("text-xl font-semibold", notGiven > 0 ? "text-amber-700" : "text-green-700")}>{notGiven}</p><p className="text-[11px] text-gray-500 mt-0.5">No replacement given</p></div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

type TabKey = "active" | "closed";

export default function UCReturnsPage() {
  const { appUser }                   = useAuth();
  const [returns, setReturns]         = useState<UCReturn[]>([]);
  const [allReturns, setAllReturns]   = useState<UCReturn[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>("active");
  const [undoState, setUndoState]     = useState<UndoState | null>(null);
  const [toDelete, setToDelete]       = useState<UCReturn | null>(null);
  const undoTimer                     = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    const q = query(ucReturnsCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => {
        const data = d.data() as Record<string, any>;
        if (data.hasOwnProperty("id")) delete data.id; // avoid duplicate id property
        return ({ id: d.id, ...data } as UCReturn);
      });
      setAllReturns(all);
      setReturns(tab === "active" ? all.filter(r => r.status !== "closed") : all.filter(r => r.status === "closed"));
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  useEffect(() => () => { if (undoTimer.current) clearInterval(undoTimer.current); }, []);

  async function handleAction(
    ucId: string, newStatus: UCReturnStatus,
    fields: Record<string, any>, prevStatus: UCReturnStatus,
    prevFields: Record<string, any>, message: string
  ) {
    await updateDoc(doc(ucReturnsCol, ucId), { ...fields, updatedAt: serverTimestamp() });
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndoState({ ucId, prevFields, newStatus, message, countdown: 10 });
    undoTimer.current = setInterval(() => {
      setUndoState(prev => {
        if (!prev) return null;
        if (prev.countdown <= 1) { clearInterval(undoTimer.current!); return null; }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  }

  async function handleUndo() {
    if (!undoState) return;
    clearInterval(undoTimer.current!);
    await updateDoc(doc(ucReturnsCol, undoState.ucId), { ...undoState.prevFields, updatedAt: serverTimestamp() });
    setUndoState(null);
  }

  async function handleDelete(uc: UCReturn) {
    await deleteDoc(doc(ucReturnsCol, uc.id));
    setToDelete(null);
  }

  const activeReturns = allReturns.filter(r => r.status !== "closed");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">UC Returns</h1>
          <p className="text-sm text-gray-500">Track defective tyre returns from shops</p>
        </div>
        <Link href="/dashboard/uc-returns/new">
          <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Add return</Button>
        </Link>
      </div>

      {tab === "active" && activeReturns.length > 0 && <SummarySection returns={activeReturns} />}

      <div className="mb-4 flex rounded-xl border border-gray-200 overflow-hidden">
        {(["active", "closed"] as TabKey[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("flex-1 py-2.5 text-sm font-medium transition-colors",
              tab === t ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-700")}>
            {t === "active"
              ? `Active (${allReturns.filter(r => r.status !== "closed").length})`
              : `Closed (${allReturns.filter(r => r.status === "closed").length})`}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" /></div>}

      {!loading && returns.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <RotateCcw className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">{tab === "active" ? "No active UC returns" : "No closed returns yet"}</p>
          {tab === "active" && <Link href="/dashboard/uc-returns/new" className="mt-4"><Button size="sm">Add first return</Button></Link>}
        </Card>
      )}

      {returns.map(uc => (
        <UCReturnCard
          key={uc.id}
          uc={uc}
          isAdmin={isAdmin}
          onAction={handleAction}
          onDelete={setToDelete}
        />
      ))}

      {undoState && <UndoToast undo={undoState} onUndo={handleUndo} onDismiss={() => setUndoState(null)} />}

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete UC return"
          description={`${toDelete.shopName} · ${toDelete.qty}× ${toDelete.productName}\n${REASON_LABELS[toDelete.reason] ?? toDelete.reason}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
