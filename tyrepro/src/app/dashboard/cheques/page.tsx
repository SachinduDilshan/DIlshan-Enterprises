"use client";

import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DeleteConfirmDialog } from "@/components/ui/DeleteConfirmDialog";
import { formatLKR, formatDate } from "@/lib/utils";
import { CalendarClock, CheckCircle } from "lucide-react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Cheque, ChequeStatus } from "@/types";
import { Tabs } from "@/components/ui/Tabs";

type TabKey = "due" | "all" | "deposited";

function daysUntil(ts: Timestamp): number {
  return Math.ceil((ts.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number) {
  if (days < 0) return <Badge variant="danger">Overdue {Math.abs(days)}d</Badge>;
  if (days === 0) return <Badge variant="danger">Due today</Badge>;
  if (days <= 2) return <Badge variant="warning">Due in {days}d</Badge>;
  if (days <= 5) return <Badge variant="warning">Due in {days}d</Badge>;
  return <Badge variant="default">Due in {days}d</Badge>;
}

export default function ChequesPage() {
  const { appUser } = useAuth();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("due");
  const [depositing, setDepositing] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Cheque | null>(null);

  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    const q = tab === "deposited"
      ? query(collection(db, "cheques"), where("status", "==", "deposited"), orderBy("depositedAt", "desc"))
      : query(collection(db, "cheques"), where("status", "==", "pending"), orderBy("dueDate", "asc"));

    const unsub = onSnapshot(q, snap => {
      setCheques(snap.docs.map(d => ({ id: d.id, ...d.data() } as Cheque)));
      setLoading(false);
    });
    return unsub;
  }, [tab]);

  const dueSoon = cheques.filter(c => daysUntil(c.dueDate) <= 5);
  const displayed = tab === "due" ? dueSoon : cheques;

  async function markDeposited(cheque: Cheque) {
    setDepositing(cheque.id);
    try {
      await updateDoc(doc(db, "cheques", cheque.id), {
        status: "deposited",
        depositedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "shops", cheque.shopId), {
        outstandingBalance: -cheque.amount,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setDepositing(null);
    }
  }

  async function handleDelete(cheque: Cheque) {
    await deleteDoc(doc(db, "cheques", cheque.id));
    setToDelete(null);
  }

  const totalPending = cheques.filter(c => c.status === "pending").length;
  const totalValue = cheques.filter(c => c.status === "pending").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">Cheque tracker</h1>
        <p className="text-sm text-gray-500">Monitor post-dated cheques</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-50 p-2.5">
            <CalendarClock className="h-5 w-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pending cheques</p>
            <p className="text-lg font-medium text-gray-900">{totalPending}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-xl bg-gray-100 p-2.5">
            <CheckCircle className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total value</p>
            <p className="text-lg font-medium text-gray-900">{formatLKR(totalValue)}</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        className="mb-4"
        active={tab}
        onChange={k => setTab(k as TabKey)}
        options={[
          { key: "due", label: `Due soon (${dueSoon.length})` },
          { key: "all", label: "All pending" },
          { key: "deposited", label: "Deposited" },
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
            {tab === "due" ? "No cheques due in the next 5 days" :
              tab === "all" ? "No pending cheques" : "No deposited cheques yet"}
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {displayed.map(cheque => {
          const days = daysUntil(cheque.dueDate);
          const isUrgent = days <= 2;
          return (
            <Card
              key={cheque.id}
              className={cn(
                "border-l-4",
                isUrgent ? "border-l-red-500" : days <= 5 ? "border-l-amber-500" : "border-l-gray-200"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{cheque.shopName}</p>
                    {tab !== "deposited" && urgencyBadge(days)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {cheque.bank} · #{cheque.chequeNo}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {cheque.invoiceNo} · Due: {formatDate(cheque.dueDate)}
                    {tab === "deposited" && cheque.depositedAt && ` · Deposited: ${formatDate(cheque.depositedAt)}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-base font-medium text-gray-900">{formatLKR(cheque.amount)}</p>

                  {tab !== "deposited" && cheque.status === "pending" && (
                    <Button
                      size="sm"
                      className={cn("border-0 text-white", isUrgent ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700")}
                      loading={depositing === cheque.id}
                      onClick={() => markDeposited(cheque)}
                    >
                      Mark deposited
                    </Button>
                  )}
                  {tab === "deposited" && (
                    <Badge variant="success">Deposited</Badge>
                  )}

                  {/* Delete — admin only */}
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
            </Card>
          );
        })}
      </div>

      {toDelete && (
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
