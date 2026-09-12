"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp,
  Timestamp, arrayUnion, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { formatLKR, formatDate } from "@/lib/utils";
import {
  CalendarClock, CheckCircle, CalendarRange,
  History, Trash2, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cheque } from "@/types";

type TabKey = "due" | "all" | "deposited";

function daysUntil(ts: Timestamp): number {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number) {
  if (days < 0)  return <Badge variant="danger">Overdue {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge variant="danger">Due today</Badge>;
  if (days <= 2)  return <Badge variant="warning">Due in {days}d</Badge>;
  if (days <= 5)  return <Badge variant="warning">Due in {days}d</Badge>;
  return <Badge variant="default">Due in {days}d</Badge>;
}

// ── Reschedule modal ──────────────────────────────────────

function RescheduleModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minStr = tomorrow.toISOString().split("T")[0];

  const [newDate, setNewDate] = useState(minStr);
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const QUICK_REASONS = ["Customer requested delay", "Bank issue", "Mutual agreement", "Other"];

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate)       { setError("Select a new due date."); return; }
    if (!reason.trim()) { setError("Reason is required."); return; }
    setSaving(true); setError("");
    try {
      const newTs     = Timestamp.fromDate(new Date(newDate));
      const chequeRef = doc(collection(db, "cheques"), cheque.id);
      await updateDoc(chequeRef, {
        originalDueDate:  cheque.originalDueDate ?? cheque.dueDate,
        dueDate:          newTs,
        rescheduledDates: arrayUnion({
          from:   cheque.dueDate,
          to:     newTs,
          reason: reason.trim(),
          at:     Timestamp.now(),
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

  const currentDays = daysUntil(cheque.dueDate);

  return (
    <Modal
      title="Reschedule cheque"
      subtitle={`${cheque.shopName} · ${formatLKR(cheque.amount)}`}
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="rounded-xl bg-gray-50 px-4 py-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Current due date</span>
            <span className={cn("font-medium", currentDays < 0 ? "text-red-600" : "text-gray-900")}>
              {formatDate(cheque.dueDate)}
              {currentDays < 0
                ? ` (${Math.abs(currentDays)}d overdue)`
                : currentDays === 0 ? " (today)"
                : ` (${currentDays}d)`}
            </span>
          </div>
          {cheque.originalDueDate && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Original due date</span>
              <span className="text-gray-400">{formatDate(cheque.originalDueDate)}</span>
            </div>
          )}
          {(cheque.rescheduledDates ?? []).length > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-700">
              <History className="h-3 w-3" />
              Rescheduled {(cheque.rescheduledDates ?? []).length} time{(cheque.rescheduledDates ?? []).length > 1 ? "s" : ""} before
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">New due date *</label>
          <input
            type="date" min={minStr} value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">Reason *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {QUICK_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  reason === r
                    ? "border-brand-400 bg-brand-50 text-brand-800"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                )}>
                {r}
              </button>
            ))}
          </div>
          <input
            value={reason === "Other" ? "" : reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Type or edit reason..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400"
          />
        </div>

        {error && <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={saving}>Reschedule</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Reschedule history modal ──────────────────────────────

function RescheduleHistory({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  return (
    <Modal
      title="Reschedule history"
      subtitle={`${cheque.shopName} · ${formatLKR(cheque.amount)}`}
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-3">
        {cheque.originalDueDate && (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium text-gray-700">Original due date</p>
              <p className="text-xs text-gray-400 mt-0.5">Set when cheque was added</p>
            </div>
            <p className="text-sm font-medium text-gray-900">{formatDate(cheque.originalDueDate)}</p>
          </div>
        )}
        {(cheque.rescheduledDates ?? []).map((r, i) => (
          <div key={i} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-medium text-amber-900">Reschedule #{i + 1}</p>
              <p className="text-xs text-amber-600">{formatDate(r.at)}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-amber-800 mb-1">
              <span>{formatDate(r.from)}</span>
              <span>→</span>
              <span className="font-medium">{formatDate(r.to)}</span>
            </div>
            <p className="text-xs text-amber-700">Reason: {r.reason}</p>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-brand-50 px-3 py-2.5">
          <p className="text-xs font-medium text-brand-800">Current due date</p>
          <p className="text-sm font-medium text-brand-900">{formatDate(cheque.dueDate)}</p>
        </div>
        <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

// ── Edit cheque modal ─────────────────────────────────────

function EditChequeModal({ cheque, onClose }: { cheque: Cheque; onClose: () => void }) {
  const [bank, setBank]         = useState(cheque.bank);
  const [chequeNo, setChequeNo] = useState(cheque.chequeNo);
  const [amount, setAmount]     = useState(cheque.amount);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!bank.trim())     { setError("Bank name is required."); return; }
    if (!chequeNo.trim()) { setError("Cheque number is required."); return; }
    if (amount <= 0)      { setError("Amount must be greater than 0."); return; }
    setSaving(true); setError("");
    try {
      await updateDoc(doc(collection(db, "cheques"), cheque.id), {
        bank:      bank.trim(),
        chequeNo:  chequeNo.trim(),
        amount:    Number(amount),
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
    >
      <form onSubmit={handleSave} className="space-y-3">
        <Input label="Bank name *" value={bank}
          onChange={e => setBank(e.target.value)}
          placeholder="e.g. People's Bank" />
        <Input label="Cheque number *" value={chequeNo}
          onChange={e => setChequeNo(e.target.value)}
          placeholder="e.g. 64020" />
        <Input label="Amount (Rs) *" type="number" min={1}
          value={amount || ""}
          onChange={e => setAmount(Number(e.target.value))}
          placeholder="e.g. 959600" />
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
          Editing the amount here does not update the linked invoice total.
        </div>
        {error && (
          <div className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
        )}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" type="button" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" type="submit" loading={saving}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────

export default function ChequesPage() {
  const { appUser }   = useAuth();
  const isAdmin       = appUser?.role === "admin";
  const canEdit       = appUser?.role === "admin" || appUser?.role === "sales_rep";

  const [cheques, setCheques]           = useState<Cheque[]>([]);
  const [allCheques, setAll]            = useState<Cheque[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<TabKey>("due");
  const [depositing, setDepositing]     = useState<string | null>(null);
  const [toDelete, setToDelete]         = useState<Cheque | null>(null);
  const [reschedule, setReschedule]     = useState<Cheque | null>(null);
  const [viewHistory, setViewHistory]   = useState<Cheque | null>(null);
  const [editCheque, setEditCheque]     = useState<Cheque | null>(null);

  // Main list — changes by tab
  useEffect(() => {
    const q = tab === "deposited"
      ? query(collection(db, "cheques"), where("status", "==", "deposited"), orderBy("depositedAt", "desc"))
      : query(collection(db, "cheques"), where("status", "==", "pending"), orderBy("dueDate", "asc"));

    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id } as Cheque;
      });
      setCheques(docs);
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  // All pending — for counts
  useEffect(() => {
    const q = query(collection(db, "cheques"), where("status", "==", "pending"), orderBy("dueDate", "asc"));
    return onSnapshot(q, snap => {
      setAll(snap.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id } as Cheque;
      }));
    });
  }, []);

  const dueSoon  = allCheques.filter(c => daysUntil(c.dueDate) <= 5);
  const displayed = tab === "due" ? dueSoon : cheques;

  const totalPending = allCheques.length;
  const totalValue   = allCheques.reduce((s, c) => s + c.amount, 0);

  async function markDeposited(cheque: Cheque) {
    setDepositing(cheque.id);
    try {
      const chequeRef = doc(collection(db, "cheques"), cheque.id);
      await updateDoc(chequeRef, {
        status:      "deposited",
        depositedAt: serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
      await updateDoc(doc(db, "shops", cheque.shopId), {
        outstandingBalance: increment(-cheque.amount),
        updatedAt:          serverTimestamp(),
      });
    } finally {
      setDepositing(null);
    }
  }

  async function handleDelete(cheque: Cheque) {
    await deleteDoc(doc(collection(db, "cheques"), cheque.id));
    setToDelete(null);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">CHEQUE TRACKER</h1>
        <p className="text-sm text-gray-500">Monitor post-dated cheques</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5 flex-shrink-0">
            <CalendarClock className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Pending cheques</p>
            <p className="text-lg font-medium text-gray-900">{totalPending}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2.5 flex-shrink-0">
            <CheckCircle className="h-5 w-5 text-gray-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Total value</p>
            <p className="text-lg font-medium text-gray-900 truncate">{formatLKR(totalValue)}</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        className="mb-4"
        active={tab}
        onChange={k => setTab(k as TabKey)}
        options={[
          { key: "due",       label: `Due soon (${dueSoon.length})`  },
          { key: "all",       label: `All pending (${totalPending})` },
          { key: "deposited", label: "Deposited"                     },
        ]}
      />

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && displayed.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <CalendarClock className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {tab === "due"       ? "No cheques due in the next 5 days" :
             tab === "all"       ? "No pending cheques" :
             "No deposited cheques yet"}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {displayed.map(cheque => {
          const days       = daysUntil(cheque.dueDate);
          const isUrgent   = days <= 2;
          const isOverdue  = days < 0;
          const hasHistory = (cheque.rescheduledDates ?? []).length > 0;

          return (
            <Card key={cheque.id}
              className={cn(
                "border-l-4",
                isOverdue ? "border-l-red-500" : isUrgent ? "border-l-amber-500" : "border-l-gray-200"
              )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900 truncate">{cheque.shopName}</p>
                    {tab !== "deposited" && urgencyBadge(days)}
                    {hasHistory && (
                      <button
                        onClick={() => setViewHistory(cheque)}
                        className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 transition-colors"
                      >
                        <History className="h-3 w-3" />
                        Rescheduled {(cheque.rescheduledDates ?? []).length}×
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {cheque.bank} · #{cheque.chequeNo}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {cheque.invoiceNo} · Due: {formatDate(cheque.dueDate)}
                    {cheque.originalDueDate && (
                      <span className="text-gray-300"> · Orig: {formatDate(cheque.originalDueDate)}</span>
                    )}
                    {tab === "deposited" && cheque.depositedAt && (
                      <> · Deposited: {formatDate(cheque.depositedAt)}</>
                    )}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <p className="text-base font-medium text-gray-900">{formatLKR(cheque.amount)}</p>

                  {tab !== "deposited" && cheque.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        className={cn(
                          "border-0 text-white text-xs",
                          isOverdue
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-amber-600 hover:bg-amber-700"
                        )}
                        loading={depositing === cheque.id}
                        onClick={() => markDeposited(cheque)}
                      >
                        Mark deposited
                      </Button>
                      {canEdit && (
                        <button
                          onClick={() => setReschedule(cheque)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <CalendarRange className="h-3.5 w-3.5" />
                          Reschedule
                        </button>
                      )}
                    </>
                  )}

                  {tab === "deposited" && (
                    <Badge variant="success">Deposited</Badge>
                  )}

                  <div className="flex items-center gap-1 mt-0.5">
                    {isAdmin && (
                      <button
                        onClick={() => setEditCheque(cheque)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                        title="Edit cheque"
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => setToDelete(cheque)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                        title="Delete cheque"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modals */}
      {reschedule  && <RescheduleModal   cheque={reschedule}  onClose={() => setReschedule(null)}  />}
      {viewHistory && <RescheduleHistory cheque={viewHistory} onClose={() => setViewHistory(null)} />}
      {editCheque  && <EditChequeModal   cheque={editCheque}  onClose={() => setEditCheque(null)}  />}
      {toDelete    && (
        <DeleteConfirmDialog
          title="Delete cheque"
          description={`${toDelete.shopName} · ${toDelete.bank} #${toDelete.chequeNo}\n${formatLKR(toDelete.amount)} · Due: ${formatDate(toDelete.dueDate)}`}
          onConfirm={() => handleDelete(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}