"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import {
  AlertTriangle, Check, ChevronDown, PackageCheck, Pencil, Plus, Send, Trash2, Undo2,
} from "lucide-react";
import { ucReturnsCol } from "@/lib/firestore-collections";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatStrip } from "@/components/ui/StatStrip";
import type { StatItem } from "@/components/ui/StatStrip";
import { cn, formatLKR } from "@/lib/utils";
import type { UCReturn, UCReturnStatus } from "@/types";

/* ------------------------------------------------------------------ */
/* Constants and helpers                                               */
/* ------------------------------------------------------------------ */

type UC = UCReturn & {
  unitPrice?: number;
  totalValue?: number;
  reasonNotes?: string | null;
};

const DAY = 86_400_000;
const WAIT_DAYS = 3;   // tyre sitting with us before it should go to CEAT
const CEAT_DAYS = 30;  // time CEAT gets before we follow up

const STATUS_META: Record<
  UCReturnStatus,
  { label: string; badge: "warning" | "info" | "default" | "success" }
> = {
  approved:             { label: "Tyre with us",         badge: "warning" },
  sent_to_supplier:     { label: "Sent to CEAT",         badge: "info" },
  awaiting_replacement: { label: "Awaiting replacement", badge: "default" },
  closed:               { label: "Closed",               badge: "success" },
};

const REASON_LABELS: Record<string, string> = {
  sidewall_bulge: "Sidewall bulge",
  tread_separation: "Tread separation",
  manufacturing_defect: "Manufacturing defect",
  bead_damage: "Bead damage",
  other: "Other",
};

const REASON_OPTIONS = Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }));

interface NextAction {
  label: string;
  icon: React.ElementType;
  message: string;
  fields: () => Record<string, any>;
  undo: Record<string, any>;
}

const NEXT_ACTIONS: Partial<Record<UCReturnStatus, NextAction>> = {
  approved: {
    label: "Mark sent to CEAT",
    icon: Send,
    message: "Marked as sent to CEAT",
    fields: () => ({ status: "sent_to_supplier", sentToSupplierAt: Timestamp.now() }),
    undo: { status: "approved", sentToSupplierAt: null },
  },
  sent_to_supplier: {
    label: "Confirm CEAT acknowledged",
    icon: Check,
    message: "Marked as acknowledged by CEAT",
    fields: () => ({ status: "awaiting_replacement" }),
    undo: { status: "sent_to_supplier" },
  },
  awaiting_replacement: {
    label: "Mark replacement received",
    icon: PackageCheck,
    message: "Marked replacement received",
    fields: () => ({ status: "closed", replacementReceivedAt: Timestamp.now() }),
    undo: { status: "awaiting_replacement", replacementReceivedAt: null },
  },
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// Whole calendar days between a past date and today
function daysSince(value: any): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.round((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / DAY);
}

function fmtDate(value: any): string {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })
    : "-";
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function valueOf(uc: UC): number {
  return Number(uc.totalValue) || (Number(uc.unitPrice) || 0) * (Number(uc.qty) || 0);
}

function followUp(uc: UC): { kind: "waiting" | "late"; days: number } | null {
  if (uc.status === "approved") {
    const d = daysSince(uc.tyreReceivedAt);
    if (d !== null && d >= WAIT_DAYS) return { kind: "waiting", days: d };
  }
  if (uc.status === "sent_to_supplier" || uc.status === "awaiting_replacement") {
    const d = daysSince(uc.sentToSupplierAt);
    if (d !== null && d >= CEAT_DAYS) return { kind: "late", days: d };
  }
  return null;
}

const btnPrimary =
  "inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60";
const btnIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800";

/* ------------------------------------------------------------------ */
/* Undo toast                                                          */
/* ------------------------------------------------------------------ */

interface UndoState {
  ucId: string;
  prevFields: Record<string, any>;
  message: string;
  countdown: number;
}

function UndoToast({ undo, onUndo }: { undo: UndoState; onUndo: () => void }) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="uc-toast fixed bottom-24 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg md:bottom-6"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{undo.message}</p>
          <p className="text-xs text-gray-300">You can undo this for {undo.countdown}s</p>
        </div>
        <button
          type="button"
          onClick={onUndo}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-sm font-medium transition-colors hover:bg-white/25"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Undo
        </button>
      </div>
      <style>{`
        @keyframes ucToastIn {
          from { transform: translate(-50%, 16px); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
        .uc-toast { animation: ucToastIn 0.2s ease-out; }
        @media (prefers-reduced-motion: reduce) { .uc-toast { animation: none; } }
      `}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Edit modal                                                          */
/* ------------------------------------------------------------------ */

function EditUCModal({ uc, onClose }: { uc: UC; onClose: () => void }) {
  const [qtyText, setQtyText] = useState(String(uc.qty));
  const [priceText, setPriceText] = useState(String(uc.unitPrice ?? 0));
  const [reason, setReason] = useState(uc.reason);
  const [notes, setNotes] = useState(uc.reasonNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qty = parseInt(qtyText, 10);
  const unitPrice = parseFloat(priceText);
  const total = Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(qty) || qty < 1) { setError("Quantity must be at least 1."); return; }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) { setError("Enter a valid unit price."); return; }

    setSaving(true);
    setError("");
    try {
      const update: Record<string, any> = {
        qty,
        unitPrice,
        totalValue: qty * unitPrice,
        reason,
        reasonNotes: notes.trim() || null,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(ucReturnsCol, uc.id), update);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit Return"
      subtitle={`${uc.shopName} · ${uc.productName}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="edit-uc-form" loading={saving}>Save changes</Button>
        </div>
      }
    >
      <form id="edit-uc-form" onSubmit={handleSave} className="space-y-3">
        <Input
          label="Quantity returned *"
          type="number"
          min={1}
          value={qtyText}
          onChange={e => setQtyText(e.target.value)}
        />
        <Input
          label="Unit price (Rs) *"
          type="number"
          min={0}
          value={priceText}
          onChange={e => setPriceText(e.target.value)}
          hint={`Total return value: ${formatLKR(total)}`}
        />
        <Dropdown
          label="Reason"
          value={reason}
          onChange={v => setReason(v as UC["reason"])}
          options={REASON_OPTIONS}
        />
        <Input
          label="Additional notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any extra details"
        />
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Progress timeline                                                   */
/* ------------------------------------------------------------------ */

function Timeline({ steps }: { steps: { label: string; date: Date | null; done: boolean }[] }) {
  const currentIdx = steps.findIndex(s => !s.done);

  return (
    <ol className="mt-4 grid grid-cols-3" aria-label="Return progress">
      {steps.map((s, i) => {
        const state = s.done ? "done" : i === currentIdx ? "current" : "upcoming";
        return (
          <li key={s.label} className="relative flex flex-col items-center px-1 text-center">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-1/2 top-3 h-0.5 w-full -translate-y-1/2",
                  steps[i - 1].done ? "bg-emerald-600" : "bg-gray-200"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-6 w-6 items-center justify-center rounded-full",
                state === "done" && "bg-emerald-600 text-white",
                state === "current" && "border-2 border-brand-600 bg-white",
                state === "upcoming" && "border-2 border-gray-300 bg-white"
              )}
            >
              {state === "done" && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {state === "current" && <span className="h-2 w-2 rounded-full bg-brand-600" />}
            </span>
            <span
              className={cn(
                "mt-1.5 text-xs font-medium",
                state === "upcoming" ? "text-gray-500" : "text-gray-900"
              )}
            >
              {s.label}
            </span>
            <span className="text-xs tabular-nums text-gray-500">
              {s.date ? fmtDate(s.date) : "\u00A0"}
            </span>
            <span className="sr-only">
              {state === "done" ? "Done" : state === "current" ? "Next step" : "Not started"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* One return                                                          */
/* ------------------------------------------------------------------ */

function UCItem({
  uc, isAdmin, busy, onAction, onEdit, onDelete,
}: {
  uc: UC;
  isAdmin: boolean;
  busy: boolean;
  onAction: (uc: UC, action: NextAction) => void;
  onEdit: (uc: UC) => void;
  onDelete: (uc: UC) => void;
}) {
  const [open, setOpen] = useState(false);

  const meta = STATUS_META[uc.status];
  const next = NEXT_ACTIONS[uc.status];
  const flag = followUp(uc);
  const notes = uc.reasonNotes?.trim();
  const NextIcon = next?.icon;

  const steps = [
    { label: "Received from shop", date: toDate(uc.tyreReceivedAt), done: !!uc.tyreReceivedFromShop },
    { label: "Sent to CEAT", date: toDate(uc.sentToSupplierAt), done: !!uc.sentToSupplierAt },
    { label: "Replacement back", date: toDate(uc.replacementReceivedAt), done: !!uc.replacementReceivedAt },
  ];

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-gray-900">{uc.shopName}</p>
            <Badge variant={meta.badge}>{meta.label}</Badge>
          </div>
          {uc.shopCity && <p className="mt-0.5 text-xs text-gray-500">{uc.shopCity}</p>}
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-900">{formatLKR(valueOf(uc))}</p>
          <p className="text-xs text-gray-500">return value</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-900">
        {uc.qty}x {uc.productName}
      </p>
      <p className="text-xs text-gray-500">
        {REASON_LABELS[uc.reason] ?? uc.reason}
        {notes ? ` · ${notes}` : ""}
        {` · Replacement for shop: ${uc.gaveTyreToShop ? "given" : "not yet"}`}
      </p>

      {flag && (
        <p
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
            flag.kind === "late"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          {flag.kind === "late"
            ? `Sent to CEAT ${plural(flag.days, "day")} ago. Follow up on the replacement.`
            : `With you for ${plural(flag.days, "day")} and not yet sent to CEAT.`}
        </p>
      )}

      <Timeline steps={steps} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {next && NextIcon && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(uc, next)}
            className={btnPrimary}
          >
            <NextIcon className="h-4 w-4" aria-hidden="true" />
            {busy ? "Saving..." : next.label}
          </button>
        )}

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
          className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-brand-700 hover:underline"
        >
          {open ? "Hide details" : "Details"}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
        </button>

        {isAdmin && (
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(uc)}
              aria-label={`Edit return for ${uc.shopName}`}
              title="Edit"
              className={btnIcon}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(uc)}
              aria-label={`Delete return for ${uc.shopName}`}
              title="Delete"
              className={cn(btnIcon, "hover:bg-red-50 hover:text-red-700")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {open && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-gray-50 p-3 text-xs">
          <div>
            <dt className="text-gray-500">Tyre</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{uc.productSku || "-"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Unit price</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-gray-900">
              {formatLKR(Number(uc.unitPrice) || 0)} x {uc.qty}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Received from shop</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{fmtDate(uc.tyreReceivedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Replacement given to shop</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {uc.gaveTyreToShop ? `Yes, ${fmtDate(uc.gaveTyreToShopAt)}` : "Not yet"}
            </dd>
          </div>
          {uc.sentToSupplierAt && (
            <div>
              <dt className="text-gray-500">Sent to CEAT</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{fmtDate(uc.sentToSupplierAt)}</dd>
            </div>
          )}
          {uc.replacementReceivedAt && (
            <div>
              <dt className="text-gray-500">CEAT replacement received</dt>
              <dd className="mt-0.5 font-medium text-gray-900">{fmtDate(uc.replacementReceivedAt)}</dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

type Tab = "active" | "closed";
type Filter = "all" | "us" | "ceat" | "follow";

export default function UCReturnsPage() {
  const { appUser } = useAuth();
  const { refreshAlerts } = useNotifications();
  const isAdmin = appUser?.role === "admin";

  const [all, setAll] = useState<UC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("active");
  const [filter, setFilter] = useState<Filter>("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [toDelete, setToDelete] = useState<UC | null>(null);
  const [editing, setEditing] = useState<UC | null>(null);

  useEffect(() => {
    const q = query(ucReturnsCol, orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      snap => {
        setAll(snap.docs.map(d => ({ ...d.data(), id: d.id }) as UC));
        setLoading(false);
      },
      err => {
        console.error("Returns load error:", err);
        setError("Could not load returns. Check your connection and try again.");
        setLoading(false);
      }
    );
  }, []);

  // Count the undo window down one second at a time
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => {
      setUndo(prev =>
        prev ? (prev.countdown <= 1 ? null : { ...prev, countdown: prev.countdown - 1 }) : null
      );
    }, 1000);
    return () => clearTimeout(t);
  }, [undo]);

  /* ---------------- actions ---------------- */

  async function handleAction(uc: UC, action: NextAction) {
    setActingId(uc.id);
    setError("");
    try {
      await updateDoc(doc(ucReturnsCol, uc.id), {
        ...action.fields(),
        updatedAt: serverTimestamp(),
      });
      setUndo({ ucId: uc.id, prevFields: action.undo, message: action.message, countdown: 10 });
      setTimeout(() => refreshAlerts(), 1500);
    } catch (err) {
      console.error("UC action error:", err);
      setError("Could not update this return. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function handleUndo() {
    if (!undo) return;
    const { ucId, prevFields } = undo;
    setUndo(null);
    try {
      await updateDoc(doc(ucReturnsCol, ucId), { ...prevFields, updatedAt: serverTimestamp() });
      setTimeout(() => refreshAlerts(), 1500);
    } catch (err) {
      console.error("UC undo error:", err);
      setError("Could not undo that change. Please check the return and fix it by hand.");
    }
  }

  async function handleDelete(uc: UC) {
    await deleteDoc(doc(ucReturnsCol, uc.id));
    setToDelete(null);
  }

  /* ---------------- derived ---------------- */

  const active = useMemo(() => all.filter(r => r.status !== "closed"), [all]);
  const closed = useMemo(() => all.filter(r => r.status === "closed"), [all]);

  const stats = useMemo(() => {
    let withUs = 0;
    let withCeat = 0;
    let follow = 0;
    let noReplacement = 0;
    let tyres = 0;
    let value = 0;
    for (const r of active) {
      if (r.status === "approved") withUs += 1;
      else withCeat += 1;
      if (followUp(r)) follow += 1;
      if (!r.gaveTyreToShop) noReplacement += 1;
      tyres += Number(r.qty) || 0;
      value += valueOf(r);
    }
    return { withUs, withCeat, follow, noReplacement, tyres, value };
  }, [active]);

  const shown = useMemo(() => {
    if (tab === "closed") {
      return [...closed].sort(
        (a, b) =>
          (toDate(b.replacementReceivedAt)?.getTime() ?? 0) -
          (toDate(a.replacementReceivedAt)?.getTime() ?? 0)
      );
    }
    return active
      .filter(r => {
        if (filter === "us") return r.status === "approved";
        if (filter === "ceat") return r.status !== "approved";
        if (filter === "follow") return !!followUp(r);
        return true;
      })
      .sort((a, b) => {
        const fa = followUp(a) ? 1 : 0;
        const fb = followUp(b) ? 1 : 0;
        if (fa !== fb) return fb - fa;
        return (toDate(a.tyreReceivedAt)?.getTime() ?? 0) - (toDate(b.tyreReceivedAt)?.getTime() ?? 0);
      });
  }, [tab, active, closed, filter]);

  const kpis: StatItem[] = [
    { label: "Tyres with us", value: String(stats.withUs), hint: "Not yet sent to CEAT" },
    { label: "With CEAT", value: String(stats.withCeat), hint: "Waiting on a replacement" },
    {
      label: "Needs follow-up",
      value: String(stats.follow),
      hint: stats.follow > 0
        ? <span className="text-amber-700">Late or waiting too long</span>
        : "Nothing overdue",
    },
    {
      label: "No replacement given",
      value: String(stats.noReplacement),
      hint: "Shop is still waiting",
    },
  ];

  const addReturn = (
    <Link
      href="/dashboard/uc-returns/new"
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:h-10"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      Add return
    </Link>
  );

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Returns"
        description="Defective tyres from shops, from collection to CEAT replacement"
        actions={addReturn}
      />

      <StatStrip items={kpis} loading={loading} className="mb-6" />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div role="tablist" aria-label="Return status" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {([
            { key: "active", label: "Active", count: active.length },
            { key: "closed", label: "Closed", count: closed.length },
          ] as { key: Tab; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setFilter("all"); }}
              className={cn(
                "flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                tab === t.key
                  ? "border-brand-600 text-gray-900"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
              )}
            >
              {t.label}
              <span className="rounded-full bg-gray-100 px-1.5 text-xs tabular-nums text-gray-600">
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter pills (active tab only) */}
      {tab === "active" && active.length > 0 && (
        <div
          className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
          role="group"
          aria-label="Filter active returns"
        >
          {([
            { key: "all", label: "All", count: active.length },
            { key: "us", label: "With us", count: stats.withUs },
            { key: "ceat", label: "With CEAT", count: stats.withCeat },
            { key: "follow", label: "Needs follow-up", count: stats.follow },
          ] as { key: Filter; label: string; count: number }[]).map(f => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex h-10 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  filter === f.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <Panel flush>
          <div className="space-y-3 p-4">
            {[0, 1].map(i => (
              <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </Panel>
      )}

      {!loading && !error && shown.length === 0 && (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <PackageCheck className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900">
              {tab === "closed"
                ? "No closed returns yet"
                : filter !== "all"
                  ? "Nothing matches this filter"
                  : "No active returns"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {tab === "closed"
                ? "Returns move here once CEAT's replacement has arrived."
                : filter !== "all"
                  ? "Try another filter."
                  : "Add a return when a shop brings back a defective tyre."}
            </p>
            {tab === "active" && filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="mt-3 text-sm font-medium text-brand-700 hover:underline"
              >
                Show all
              </button>
            )}
            {tab === "active" && filter === "all" && <div className="mt-4">{addReturn}</div>}
          </div>
        </Panel>
      )}

      {!loading && shown.length > 0 && (
        <Panel
          title={tab === "active" ? "Active returns" : "Closed returns"}
          description={
            tab === "active"
              ? `${plural(active.length, "return")} · ${plural(stats.tyres, "tyre")} · ${formatLKR(stats.value)} in value`
              : plural(shown.length, "return")
          }
          flush
        >
          <ul className="divide-y divide-gray-100">
            {shown.map(uc => (
              <UCItem
                key={uc.id}
                uc={uc}
                isAdmin={isAdmin}
                busy={actingId === uc.id}
                onAction={handleAction}
                onEdit={setEditing}
                onDelete={setToDelete}
              />
            ))}
          </ul>
        </Panel>
      )}

      {undo && <UndoToast undo={undo} onUndo={handleUndo} />}
      {editing && <EditUCModal uc={editing} onClose={() => setEditing(null)} />}
      {toDelete && (
        <DeleteConfirmDialog
          title="Delete Return"
          description={`${toDelete.shopName} · ${toDelete.qty}x ${toDelete.productName}\n${REASON_LABELS[toDelete.reason] ?? toDelete.reason}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}