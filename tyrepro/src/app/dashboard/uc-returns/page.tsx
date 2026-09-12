"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  query, orderBy, onSnapshot, doc,
  updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { ucReturnsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Dropdown } from "@/components/ui/Dropdown";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { Tabs } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils";
import {
  Plus, PackageCheck, Send, Clock, CheckCircle,
  AlertTriangle, Undo2, Pencil, Trash2,
  ChevronDown, ChevronUp, MapPin, Tag, Calendar,
} from "lucide-react";
import type { UCReturn, UCReturnStatus } from "@/types";

// ── Constants ─────────────────────────────────────────────

const STATUS_META: Record<UCReturnStatus, {
  label: string; badge: "warning"|"info"|"default"|"success";
  icon: React.ElementType; btnClass: string;
}> = {
  approved:             { label: "Tyre with us",       badge: "warning", icon: PackageCheck, btnClass: "bg-amber-600 hover:bg-amber-700 text-white border-0" },
  sent_to_supplier:     { label: "Sent to CEAT",        badge: "info",    icon: Send,         btnClass: "bg-blue-600 hover:bg-blue-700 text-white border-0"   },
  awaiting_replacement: { label: "Awaiting replacement",badge: "default", icon: Clock,        btnClass: "bg-gray-700 hover:bg-gray-800 text-white border-0"   },
  closed:               { label: "Closed",              badge: "success", icon: CheckCircle,  btnClass: "bg-green-600 hover:bg-green-700 text-white border-0"  },
};

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge:       "Sidewall bulge",
  tread_separation:     "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage:          "Bead damage",
  other:                "Other",
};

function fmtDt(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("en-LK", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function daysSince(ts: Timestamp | undefined): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - ts.toDate().getTime()) / 86_400_000);
}

// ── Undo toast ────────────────────────────────────────────

interface UndoState {
  ucId: string; prevFields: Record<string, any>;
  message: string; countdown: number;
}

function UndoToast({ undo, onUndo, onDismiss }: {
  undo: UndoState; onUndo: () => void; onDismiss: () => void;
}) {
  useEffect(() => { if (undo.countdown <= 0) onDismiss(); }, [undo.countdown]);
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-xl min-w-[280px]"
      style={{ animation: "slideUp 0.2s ease" }}>
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

// ── Edit UC return modal ──────────────────────────────────

function EditUCModal({ uc, onClose }: { uc: UCReturn; onClose: () => void }) {
  const [qty, setQty]             = useState(uc.qty);
  const [unitPrice, setUnitPrice] = useState((uc as any).unitPrice ?? 0);
  const [reason, setReason]       = useState(uc.reason);
  const [reasonNotes, setNotes]   = useState((uc as any).reasonNotes ?? "");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(ucReturnsCol, uc.id), {
        qty, unitPrice, totalValue: qty * unitPrice,
        reason, reasonNotes: reasonNotes.trim() || null,
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Edit UC return" subtitle={`${uc.shopName} · ${uc.productName}`}
      onClose={onClose} size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="edit-uc-form" loading={saving}>Save changes</Button>
        </div>
      }
    >
      <form id="edit-uc-form" onSubmit={handleSave} className="space-y-3">
        <Input label="Quantity returned *" type="number" min={1}
          value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
        <Input label="Unit price (Rs) *" type="number" min={0}
          value={unitPrice} onChange={e => setUnitPrice(parseFloat(e.target.value) || 0)} />
        <Dropdown label="Reason" value={reason}
          onChange={v => setReason(v as any)}
          options={[
            { value: "sidewall_bulge",       label: "Sidewall bulge"       },
            { value: "tread_separation",     label: "Tread separation"     },
            { value: "manufacturing_defect", label: "Manufacturing defect" },
            { value: "bead_damage",          label: "Bead damage"          },
            { value: "other",                label: "Other"                },
          ]} />
        <Input label="Additional notes" value={reasonNotes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any extra details..." />
        {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  );
}

// ── UC Return Card ────────────────────────────────────────

function UCCard({ uc, isAdmin, onAction, onDelete, onEdit }: {
  uc: UCReturn; isAdmin: boolean;
  onAction: (ucId: string, newStatus: UCReturnStatus, fields: Record<string, any>, prevFields: Record<string, any>, message: string) => void;
  onDelete: (uc: UCReturn) => void;
  onEdit:   (uc: UCReturn) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta       = STATUS_META[uc.status];
  const StatusIcon = meta.icon;
  const daysWithUs = daysSince(uc.tyreReceivedAt);
  const daysSent   = daysSince(uc.sentToSupplierAt);
  const totalVal   = (uc as any).totalValue ?? 0;

  const STEPS = [
    { label: "Received from shop", done: uc.tyreReceivedFromShop,     date: uc.tyreReceivedAt        },
    { label: "Sent to CEAT",       done: !!uc.sentToSupplierAt,       date: uc.sentToSupplierAt      },
    { label: "Replacement back",   done: !!uc.replacementReceivedAt,  date: uc.replacementReceivedAt },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3 transition-shadow hover:shadow-sm">
      {/* Status bar at top */}
      <div className={cn("h-1 w-full",
        uc.status === "approved"             ? "bg-amber-400" :
        uc.status === "sent_to_supplier"     ? "bg-blue-400"  :
        uc.status === "awaiting_replacement" ? "bg-gray-300"  : "bg-green-400"
      )} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <p className="text-sm font-semibold text-gray-900">{uc.shopName}</p>
              <Badge variant={meta.badge}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {meta.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span>{uc.shopCity}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isAdmin && (
              <>
                <button onClick={() => onEdit(uc)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors">
                  <Pencil className="h-3.5 w-3.5 text-gray-400" />
                </button>
                <button onClick={() => onDelete(uc)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors">
                  <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tyre info */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Tyre</p>
            <p className="text-xs font-medium text-gray-900 truncate">{uc.productName}</p>
            <p className="text-[10px] text-gray-400">{uc.productSku}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">Return value</p>
            <p className="text-sm font-semibold text-gray-900">Rs {totalVal.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">{uc.qty} tyre{uc.qty > 1 ? "s" : ""} · Rs {((uc as any).unitPrice ?? 0).toLocaleString()} each</p>
          </div>
        </div>

        {/* Reason row */}
        <div className="flex items-center gap-3 mb-3 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 text-gray-400" />
            <span>{REASON_LABELS[uc.reason] ?? uc.reason}</span>
            {(uc as any).reasonNotes && (
              <span className="text-gray-400">— {(uc as any).reasonNotes}</span>
            )}
          </div>
        </div>

        {/* Alert banners */}
        {uc.status === "approved" && daysWithUs !== null && daysWithUs >= 3 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 mb-3">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Tyre with you <span className="font-semibold">{daysWithUs} days</span> — not sent to CEAT
            </p>
          </div>
        )}
        {(uc.status === "sent_to_supplier" || uc.status === "awaiting_replacement") && daysSent !== null && daysSent >= 30 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 mb-3">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0" />
            <p className="text-xs text-red-800">
              Sent to CEAT <span className="font-semibold">{daysSent} days ago</span> — follow up!
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="flex items-start mb-3">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  "h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  step.done ? "border-green-500 bg-green-500" : "border-gray-200 bg-white"
                )}>
                  {step.done && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 text-center leading-tight">{step.label}</p>
                {step.date && (
                  <p className="text-[10px] text-gray-400 text-center mt-0.5">{fmtDt(step.date)}</p>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-0.5 w-6 flex-shrink-0 mx-0.5 mt-[-20px]",
                  step.done ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>

        {/* Expandable extra details */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 transition-colors mb-3"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide details" : "Show details"}
        </button>

        {expanded && (
          <div className="rounded-xl bg-gray-50 p-3 mb-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5">Received from shop</p>
              <p className="font-medium text-gray-900">{fmtDt(uc.tyreReceivedAt)}</p>
            </div>
            <div>
              <p className="text-gray-400 mb-0.5">Replacement given to shop</p>
              <p className={cn("font-medium", uc.gaveTyreToShop ? "text-green-700" : "text-amber-700")}>
                {uc.gaveTyreToShop ? `Yes · ${fmtDt(uc.gaveTyreToShopAt)}` : "Not yet"}
              </p>
            </div>
            {uc.sentToSupplierAt && (
              <div>
                <p className="text-gray-400 mb-0.5">Sent to CEAT</p>
                <p className="font-medium text-gray-900">{fmtDt(uc.sentToSupplierAt)}</p>
              </div>
            )}
            {uc.replacementReceivedAt && (
              <div>
                <p className="text-gray-400 mb-0.5">CEAT replacement received</p>
                <p className="font-medium text-gray-900">{fmtDt(uc.replacementReceivedAt)}</p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {uc.status === "approved" && (
            <Button size="sm" className={meta.btnClass}
              onClick={() => onAction(uc.id, "sent_to_supplier",
                { status: "sent_to_supplier", sentToSupplierAt: Timestamp.now() },
                { status: "approved", sentToSupplierAt: null },
                "Marked as sent to CEAT"
              )}>
              <Send className="h-3.5 w-3.5" /> Mark sent to CEAT
            </Button>
          )}
          {uc.status === "sent_to_supplier" && (
            <Button size="sm" className={STATUS_META.sent_to_supplier.btnClass}
              onClick={() => onAction(uc.id, "awaiting_replacement",
                { status: "awaiting_replacement" },
                { status: "sent_to_supplier" },
                "Marked CEAT acknowledged"
              )}>
              <CheckCircle className="h-3.5 w-3.5" /> Confirm CEAT acknowledged
            </Button>
          )}
          {uc.status === "awaiting_replacement" && (
            <Button size="sm" className={STATUS_META.closed.btnClass}
              onClick={() => onAction(uc.id, "closed",
                { status: "closed", replacementReceivedAt: Timestamp.now() },
                { status: "awaiting_replacement", replacementReceivedAt: null },
                "Marked replacement received"
              )}>
              <PackageCheck className="h-3.5 w-3.5" /> Mark replacement received
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Summary ───────────────────────────────────────────────

function Summary({ returns }: { returns: UCReturn[] }) {
  const totalQty   = returns.reduce((s, r) => s + r.qty, 0);
  const totalValue = returns.reduce((s, r) => s + ((r as any).totalValue ?? 0), 0);
  const withUs     = returns.filter(r => r.status === "approved").length;
  const withCEAT   = returns.filter(r => r.status === "sent_to_supplier" || r.status === "awaiting_replacement").length;
  const notGiven   = returns.filter(r => !r.gaveTyreToShop).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-5">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-medium text-gray-900">Active summary</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {returns.length} returns · {totalQty} tyres · Rs {totalValue.toLocaleString()} total value
        </p>
      </div>
      <div className="grid grid-cols-3 divide-x divide-gray-100">
        <div className="px-3 py-3 text-center">
          <p className="text-xl font-semibold text-amber-700">{withUs}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">With us</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className="text-xl font-semibold text-blue-700">{withCEAT}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">With CEAT</p>
        </div>
        <div className="px-3 py-3 text-center">
          <p className={cn("text-xl font-semibold", notGiven > 0 ? "text-amber-700" : "text-green-700")}>
            {notGiven}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">No replacement</p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

type TabKey = "active" | "closed";

export default function UCReturnsPage() {
  const { appUser }                   = useAuth();
  const isAdmin                       = appUser?.role === "admin";
  const [allReturns, setAllReturns]   = useState<UCReturn[]>([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState<TabKey>("active");
  const [undoState, setUndoState]     = useState<UndoState | null>(null);
  const [toDelete, setToDelete]       = useState<UCReturn | null>(null);
  const [editUC, setEditUC]           = useState<UCReturn | null>(null);
  const undoTimer                     = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const q = query(ucReturnsCol, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setAllReturns(snap.docs.map(d => ({ ...d.data(), id: d.id } as UCReturn)));
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => () => { if (undoTimer.current) clearInterval(undoTimer.current); }, []);

  const displayed = tab === "active"
    ? allReturns.filter(r => r.status !== "closed")
    : allReturns.filter(r => r.status === "closed");

  async function handleAction(
    ucId: string, newStatus: UCReturnStatus,
    fields: Record<string, any>, prevFields: Record<string, any>, message: string
  ) {
    await updateDoc(doc(ucReturnsCol, ucId), { ...fields, updatedAt: serverTimestamp() });
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndoState({ ucId, prevFields, message, countdown: 10 });
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
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">UC Returns</h1>
          <p className="text-sm text-gray-500">Track defective tyre returns from shops</p>
        </div>
        <Link href="/dashboard/uc-returns/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> Add return
          </Button>
        </Link>
      </div>

      {/* Summary */}
      {activeReturns.length > 0 && <Summary returns={activeReturns} />}

      {/* Tabs */}
      <Tabs
        className="mb-4"
        active={tab}
        onChange={k => setTab(k as TabKey)}
        options={[
          { key: "active", label: `Active (${activeReturns.length})`                              },
          { key: "closed", label: `Closed (${allReturns.filter(r => r.status === "closed").length})` },
        ]}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <div className="flex flex-col items-center py-14 text-center bg-white rounded-2xl border border-gray-100">
          <div className="h-12 w-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
            <PackageCheck className="h-6 w-6 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            {tab === "active" ? "No active UC returns" : "No closed returns yet"}
          </p>
          {tab === "active" && (
            <Link href="/dashboard/uc-returns/new" className="mt-4">
              <Button size="sm">Add first return</Button>
            </Link>
          )}
        </div>
      )}

      {displayed.map(uc => (
        <UCCard
          key={uc.id}
          uc={uc}
          isAdmin={isAdmin}
          onAction={handleAction}
          onDelete={setToDelete}
          onEdit={setEditUC}
        />
      ))}

      {/* Modals */}
      {undoState && (
        <UndoToast undo={undoState} onUndo={handleUndo} onDismiss={() => setUndoState(null)} />
      )}
      {editUC && <EditUCModal uc={editUC} onClose={() => setEditUC(null)} />}
      {toDelete && (
        <DeleteConfirmDialog
          title="Delete UC return"
          description={`${toDelete.shopName} · ${toDelete.qty}× ${toDelete.productName}\n${REASON_LABELS[toDelete.reason] ?? toDelete.reason}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}

      {/* Animation keyframe */}
      <style>{`
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}