"use client";

import { useEffect, useMemo, useState } from "react";
import {
  arrayUnion, collection, deleteDoc, doc, increment, onSnapshot,
  orderBy, query, serverTimestamp, Timestamp, updateDoc,
} from "firebase/firestore";
import { CalendarClock, CalendarRange, Check, History, Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatStrip } from "@/components/ui/StatStrip";
import type { StatItem } from "@/components/ui/StatStrip";
import { triggerAlerts } from "@/lib/triggerAlerts";
import { cn, formatDate, formatLKR } from "@/lib/utils";
import type { Cheque } from "@/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DAY = 86_400_000;
const SOON_DAYS = 5;

type TabKey = "due" | "all" | "deposited";

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

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Whole calendar days from today to the due date (negative when overdue)
function daysFromToday(value: any): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / DAY);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function dueBadge(days: number | null) {
  if (days === null) return null;
  if (days < 0) return <Badge variant="danger">{plural(Math.abs(days), "day")} overdue</Badge>;
  if (days === 0) return <Badge variant="danger">Due today</Badge>;
  if (days === 1) return <Badge variant="warning">Due tomorrow</Badge>;
  if (days <= SOON_DAYS) return <Badge variant="warning">Due in {days} days</Badge>;
  return <Badge>Due in {days} days</Badge>;
}

const btnSmall =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50";
const btnPrimarySmall =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white transition-colors hover:bg-brand-700";
const btnIcon =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800";

/* ------------------------------------------------------------------ */
/* Reschedule modal                                                    */
/* ------------------------------------------------------------------ */

const QUICK_REASONS = ["Customer requested delay", "Bank issue", "Mutual agreement", "Other"];

function RescheduleModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  const today = startOfDay(new Date());
  const due = toDate(cheque.dueDate) ?? today;
  const base = startOfDay(due) > today ? startOfDay(due) : today;
  const minDate = toInputDate(addDays(today, 1));
  const currentDays = daysFromToday(cheque.dueDate);
  const history = cheque.rescheduledDates ?? [];

  const [newDate, setNewDate] = useState(toInputDate(addDays(base, 3)));
  const [chip, setChip] = useState("");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reason = chip === "Other" ? custom.trim() : chip;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate) { setError("Select a new due date."); return; }
    if (!reason) { setError("Choose or enter a reason."); return; }

    setSaving(true);
    setError("");
    try {
      const newTs = Timestamp.fromDate(new Date(`${newDate}T23:59:59`));
      await updateDoc(doc(collection(db, "cheques"), cheque.id), {
        originalDueDate: cheque.originalDueDate ?? cheque.dueDate,
        dueDate: newTs,
        rescheduledDates: arrayUnion({
          from: cheque.dueDate,
          to: newTs,
          reason,
          at: Timestamp.now(),
        }),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Reschedule cheque"
      subtitle={`${cheque.shopName} · ${formatLKR(cheque.amount)}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="reschedule-form" loading={saving}>Reschedule</Button>
        </div>
      }
    >
      <form id="reschedule-form" onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5 rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-gray-600">Current due date</span>
            <span className={cn("font-medium", currentDays !== null && currentDays < 0 ? "text-red-700" : "text-gray-900")}>
              {formatDate(cheque.dueDate)}
              {currentDays !== null && currentDays < 0 && ` (${plural(Math.abs(currentDays), "day")} overdue)`}
            </span>
          </div>
          {cheque.originalDueDate && (
            <div className="flex justify-between gap-3">
              <span className="text-gray-600">Original due date</span>
              <span className="text-gray-900">{formatDate(cheque.originalDueDate)}</span>
            </div>
          )}
          {history.length > 0 && (
            <p className="text-xs text-amber-800">Already rescheduled {plural(history.length, "time")}</p>
          )}
        </div>

        <div>
          <label htmlFor="new-due" className="mb-1 block text-sm font-medium text-gray-700">
            New due date *
          </label>
          <input
            id="new-due"
            type="date"
            min={minDate}
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: "+3 days", n: 3 },
              { label: "+1 week", n: 7 },
              { label: "+2 weeks", n: 14 },
            ].map(opt => {
              const value = toInputDate(addDays(base, opt.n));
              return (
                <button
                  key={opt.n}
                  type="button"
                  onClick={() => setNewDate(value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    newDate === value
                      ? "border-brand-600 bg-brand-50 text-brand-800"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            Quick picks count from {base > today ? "the current due date" : "today"}.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Reason *</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setChip(r)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  chip === r
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                {r}
              </button>
            ))}
          </div>
          {chip === "Other" && (
            <input
              autoFocus
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Describe the reason"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          )}
        </div>

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
/* History modal                                                       */
/* ------------------------------------------------------------------ */

function HistoryModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  return (
    <Modal
      title="Reschedule history"
      subtitle={`${cheque.shopName} · ${formatLKR(cheque.amount)}`}
      onClose={onClose}
      size="sm"
      footer={<Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>}
    >
      <ol className="space-y-3">
        {cheque.originalDueDate && (
          <li className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-gray-700">Original due date</p>
              <p className="text-xs text-gray-500">Set when the cheque was added</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{formatDate(cheque.originalDueDate)}</p>
          </li>
        )}

        {(cheque.rescheduledDates ?? []).map((r, i) => (
          <li key={i} className="rounded-xl border border-gray-200 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-gray-900">Change {i + 1}</p>
              <p className="text-xs text-gray-500">{formatDate(r.at)}</p>
            </div>
            <p className="text-sm text-gray-700">
              {formatDate(r.from)} to <span className="font-medium text-gray-900">{formatDate(r.to)}</span>
            </p>
            <p className="mt-1 text-xs text-gray-500">Reason: {r.reason}</p>
          </li>
        ))}

        <li className="flex items-center justify-between gap-3 rounded-xl bg-brand-50 px-3 py-2.5">
          <p className="text-xs font-medium text-brand-800">Current due date</p>
          <p className="text-sm font-semibold text-brand-900">{formatDate(cheque.dueDate)}</p>
        </li>
      </ol>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Edit modal                                                          */
/* ------------------------------------------------------------------ */

function EditChequeModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  const [bank, setBank] = useState(cheque.bank);
  const [chequeNo, setChequeNo] = useState(cheque.chequeNo);
  const [amount, setAmount] = useState(cheque.amount);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!bank.trim()) { setError("Bank name is required."); return; }
    if (!chequeNo.trim()) { setError("Cheque number is required."); return; }
    if (amount <= 0) { setError("Amount must be greater than 0."); return; }

    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(collection(db, "cheques"), cheque.id), {
        bank: bank.trim(),
        chequeNo: chequeNo.trim(),
        amount: Number(amount),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit cheque details"
      subtitle={`${cheque.shopName} · ${cheque.invoiceNo}`}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" form="edit-cheque-form" loading={saving}>Save changes</Button>
        </div>
      }
    >
      <form id="edit-cheque-form" onSubmit={handleSave} className="space-y-3">
        <Input label="Bank name *" value={bank} onChange={e => setBank(e.target.value)} placeholder="e.g. People's Bank" />
        <Input label="Cheque number *" value={chequeNo} onChange={e => setChequeNo(e.target.value)} placeholder="e.g. 64020" />
        <Input
          label="Amount (Rs) *"
          type="number"
          min={1}
          value={amount || ""}
          onChange={e => setAmount(Number(e.target.value))}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          Changing the amount here does not change the linked invoice total.
        </div>
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
/* Cheque row                                                          */
/* ------------------------------------------------------------------ */

function ChequeItem({
  cheque, deposited, canEdit, isAdmin,
  onDeposit, onReschedule, onHistory, onEdit, onDelete,
}: {
  cheque: Cheque;
  deposited: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  onDeposit: (c: Cheque) => void;
  onReschedule: (c: Cheque) => void;
  onHistory: (c: Cheque) => void;
  onEdit: (c: Cheque) => void;
  onDelete: (c: Cheque) => void;
}) {
  const days = daysFromToday(cheque.dueDate);
  const changes = (cheque.rescheduledDates ?? []).length;
  const showActions = (!deposited && canEdit) || isAdmin;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium text-gray-900">{cheque.shopName}</p>
            {deposited ? <Badge variant="success">Deposited</Badge> : dueBadge(days)}
            {changes > 0 && (
              <button
                type="button"
                onClick={() => onHistory(cheque)}
                className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100"
              >
                <History className="h-3 w-3" aria-hidden="true" />
                Rescheduled {changes}x
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {cheque.bank} · #{cheque.chequeNo} · {cheque.invoiceNo}
          </p>
          <p className="text-xs text-gray-500">
            Due {formatDate(cheque.dueDate)}
            {cheque.originalDueDate && ` (originally ${formatDate(cheque.originalDueDate)})`}
            {deposited && cheque.depositedAt && ` · Deposited ${formatDate(cheque.depositedAt)}`}
          </p>
        </div>
        <p className="flex-shrink-0 text-sm font-semibold tabular-nums text-gray-900">
          {formatLKR(cheque.amount)}
        </p>
      </div>

      {showActions && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!deposited && canEdit && (
            <>
              <button type="button" onClick={() => onDeposit(cheque)} className={btnPrimarySmall}>
                <Check className="h-4 w-4" aria-hidden="true" />
                Mark deposited
              </button>
              <button type="button" onClick={() => onReschedule(cheque)} className={btnSmall}>
                <CalendarRange className="h-4 w-4" aria-hidden="true" />
                Reschedule
              </button>
            </>
          )}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(cheque)}
                aria-label={`Edit cheque ${cheque.chequeNo}`}
                title="Edit cheque"
                className={btnIcon}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(cheque)}
                aria-label={`Delete cheque ${cheque.chequeNo}`}
                title="Delete cheque"
                className={cn(btnIcon, "hover:bg-red-50 hover:text-red-700")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ChequesPage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const canEdit = isAdmin || appUser?.role === "sales_rep";

  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("due");

  const [toDeposit, setToDeposit] = useState<Cheque | null>(null);
  const [toDelete, setToDelete] = useState<Cheque | null>(null);
  const [reschedule, setReschedule] = useState<Cheque | null>(null);
  const [viewHistory, setViewHistory] = useState<Cheque | null>(null);
  const [editing, setEditing] = useState<Cheque | null>(null);

  // One listener for every cheque, filtered in memory. Needs no composite index.
  useEffect(() => {
    const q = query(collection(db, "cheques"), orderBy("dueDate", "asc"));
    return onSnapshot(
      q,
      snap => {
        setCheques(snap.docs.map(d => ({ ...d.data(), id: d.id }) as Cheque));
        setError("");
        setLoading(false);
      },
      err => {
        console.error("Cheques load error:", err);
        setError("Could not load cheques. Check your connection and try again.");
        setLoading(false);
      }
    );
  }, []);

  /* ---------------- actions ---------------- */

  async function markDeposited(cheque: Cheque) {
    await updateDoc(doc(collection(db, "cheques"), cheque.id), {
      status: "deposited",
      depositedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await updateDoc(doc(db, "shops", cheque.shopId), {
        outstandingBalance: increment(-cheque.amount),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Could not update shop balance:", err);
    }
    triggerAlerts();
    setToDeposit(null);
  }

  async function handleDelete(cheque: Cheque) {
    await deleteDoc(doc(collection(db, "cheques"), cheque.id));
    setToDelete(null);
  }

  /* ---------------- derived ---------------- */

  const { pending, deposited } = useMemo(() => {
    const pendingList = cheques.filter(c => c.status === "pending");
    const depositedList = cheques
      .filter(c => c.status === "deposited")
      .sort(
        (a, b) =>
          (toDate(b.depositedAt)?.getTime() ?? 0) - (toDate(a.depositedAt)?.getTime() ?? 0)
      );
    return { pending: pendingList, deposited: depositedList };
  }, [cheques]);

  const stats = useMemo(() => {
    const overdue: Cheque[] = [];
    const soon: Cheque[] = [];
    let next: Cheque | null = null;
    let nextDays = 0;
    let total = 0;

    for (const c of pending) {
      total += Number(c.amount) || 0;
      const d = daysFromToday(c.dueDate);
      if (d === null) continue;
      if (d < 0) overdue.push(c);
      else {
        if (d <= SOON_DAYS) soon.push(c);
        if (!next) { next = c; nextDays = d; }
      }
    }
    const sum = (list: Cheque[]) => list.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { total, overdue, soon, next, nextDays, overdueSum: sum(overdue), soonSum: sum(soon) };
  }, [pending]);

  const dueSoonList = useMemo(
    () =>
      pending.filter(c => {
        const d = daysFromToday(c.dueDate);
        return d !== null && d <= SOON_DAYS;
      }),
    [pending]
  );

  const groups = useMemo(() => {
    if (tab === "deposited") {
      return [{ key: "deposited", label: "", items: deposited }];
    }
    const source = tab === "due" ? dueSoonList : pending;
    const overdue: Cheque[] = [];
    const soon: Cheque[] = [];
    const later: Cheque[] = [];
    for (const c of source) {
      const d = daysFromToday(c.dueDate);
      if (d !== null && d < 0) overdue.push(c);
      else if (d !== null && d <= SOON_DAYS) soon.push(c);
      else later.push(c);
    }
    return [
      { key: "overdue", label: "Overdue", items: overdue },
      { key: "soon", label: `Due in the next ${SOON_DAYS} days`, items: soon },
      { key: "later", label: "Later", items: later },
    ].filter(g => g.items.length > 0);
  }, [tab, pending, deposited, dueSoonList]);

  const visibleCount = groups.reduce((s, g) => s + g.items.length, 0);

  const nextLabel = stats.next
    ? stats.nextDays === 0 ? "Today" : stats.nextDays === 1 ? "Tomorrow" : `In ${stats.nextDays} days`
    : "-";

  const kpis: StatItem[] = [
    { label: "Pending value", value: formatLKR(stats.total), hint: plural(pending.length, "cheque") },
    {
      label: "Overdue",
      value: String(stats.overdue.length),
      hint: stats.overdue.length > 0
        ? <span className="text-red-700">{formatLKR(stats.overdueSum)}</span>
        : "None overdue",
    },
    {
      label: `Due in ${SOON_DAYS} days`,
      value: String(stats.soon.length),
      hint: stats.soon.length > 0 ? formatLKR(stats.soonSum) : "Nothing due soon",
    },
    { label: "Next due", value: nextLabel, hint: stats.next ? stats.next.shopName : "No upcoming cheques" },
  ];

  /* ---------------- render ---------------- */

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader title="Cheques" description="Post-dated cheques, due dates and deposits" />

      <StatStrip items={kpis} loading={loading} className="mb-6" />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div role="tablist" aria-label="Cheque views" className="scrollbar-none -mb-px flex gap-1 overflow-x-auto">
          {([
            { key: "due", label: "Due soon", count: dueSoonList.length },
            { key: "all", label: "All pending", count: pending.length },
            { key: "deposited", label: "Deposited", count: deposited.length },
          ] as { key: TabKey; label: string; count: number }[]).map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
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

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <Panel flush>
          <div className="space-y-2 p-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </Panel>
      )}

      {!loading && !error && visibleCount === 0 && (
        <Panel>
          <div className="flex flex-col items-center py-10 text-center">
            <CalendarClock className="mb-3 h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900">
              {tab === "due"
                ? `No cheques due in the next ${SOON_DAYS} days`
                : tab === "all"
                  ? "No pending cheques"
                  : "No deposited cheques yet"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {tab === "due" && pending.length > 0
                ? `${plural(pending.length, "cheque")} pending further out. See All pending.`
                : "Cheques appear here when an invoice is paid by cheque."}
            </p>
            {tab === "due" && pending.length > 0 && (
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-3 text-sm font-medium text-brand-700 hover:underline"
              >
                View all pending
              </button>
            )}
          </div>
        </Panel>
      )}

      {!loading && visibleCount > 0 && (
        <Panel flush>
          {groups.map(g => (
            <div key={g.key}>
              {g.label && (
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      g.key === "overdue" ? "text-red-700" : "text-gray-600"
                    )}
                  >
                    {g.label}
                  </p>
                  <p className="text-xs tabular-nums text-gray-600">
                    {plural(g.items.length, "cheque")} · {formatLKR(g.items.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                  </p>
                </div>
              )}
              <ul className="divide-y divide-gray-100 border-b border-gray-100 last:border-b-0">
                {g.items.map(cheque => (
                  <ChequeItem
                    key={cheque.id}
                    cheque={cheque}
                    deposited={tab === "deposited"}
                    canEdit={canEdit}
                    isAdmin={isAdmin}
                    onDeposit={setToDeposit}
                    onReschedule={setReschedule}
                    onHistory={setViewHistory}
                    onEdit={setEditing}
                    onDelete={setToDelete}
                  />
                ))}
              </ul>
            </div>
          ))}
        </Panel>
      )}

      {/* Dialogs */}
      {toDeposit && (
        <ConfirmDialog
          title="Mark as deposited?"
          description={`${toDeposit.shopName} · ${toDeposit.bank} #${toDeposit.chequeNo}\n${formatLKR(toDeposit.amount)}\n\nThis lowers the shop's outstanding balance by the cheque amount.`}
          confirmLabel="Mark deposited"
          icon={Check}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
          onConfirm={() => markDeposited(toDeposit)}
          onCancel={() => setToDeposit(null)}
        />
      )}

      {reschedule && <RescheduleModal cheque={reschedule} onClose={() => setReschedule(null)} />}
      {viewHistory && <HistoryModal cheque={viewHistory} onClose={() => setViewHistory(null)} />}
      {editing && <EditChequeModal cheque={editing} onClose={() => setEditing(null)} />}

      {toDelete && (
        <DeleteConfirmDialog
          title="Delete cheque"
          description={`${toDelete.shopName} · ${toDelete.bank} #${toDelete.chequeNo}\n${formatLKR(toDelete.amount)} · Due ${formatDate(toDelete.dueDate)}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}