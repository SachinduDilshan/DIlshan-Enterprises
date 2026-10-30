"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection, getDocs, orderBy, query, Timestamp, where,
} from "firebase/firestore";
import { CheckCircle2, ChevronRight, Plus, Truck } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { useStock } from "@/hooks/useStock";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatStrip } from "@/components/ui/StatStrip";
import type { StatItem } from "@/components/ui/StatStrip";
import { PaymentMix } from "@/components/ui/PaymentMix";
import { cn, formatLKR } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types and helpers                                                   */
/* ------------------------------------------------------------------ */

interface InvoiceRow {
  id: string;
  invoiceNo?: string;
  shopName?: string;
  totalAmount?: number;
  paymentType?: string;
  status?: string;
  invoiceDate?: any;
}

interface ChequeRow {
  id: string;
  shopName?: string;
  amount?: number;
  dueDate?: any;
  status?: string;
}

interface UCRow {
  id: string;
  shopName?: string;
  productName?: string;
  status?: string;
  tyreReceivedAt?: any;
  sentToSupplierAt?: any;
}

interface AttentionItem {
  id: string;
  tone: "danger" | "warning";
  title: string;
  detail: string;
  href: string;
}

const DAY = 86_400_000;

function toDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days from b to a (positive when a is later than b)
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function nameList(names: string[], max = 2): string {
  const unique = Array.from(new Set(names.filter(Boolean)));
  if (unique.length <= max) return unique.join(", ");
  return `${unique.slice(0, max).join(", ")} +${unique.length - max} more`;
}

function paymentLabel(type?: string): string {
  if (!type) return "-";
  if (type === "cash") return "Cash";
  if (type === "card") return "Card";
  if (type === "pending") return "Pending";
  if (type.startsWith("cheque_")) return type.replace("cheque_", "Cheque ").replace(/d$/, " days");
  return type;
}

function whenLabel(d: Date | null): string {
  if (!d) return "";
  const diff = dayDiff(new Date(), d);
  const time = d.toLocaleTimeString("en-LK", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Yesterday, ${time}`;
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
}

function deltaHint(today: number, yesterday: number) {
  if (today === 0 && yesterday === 0) return <span>No sales yet today</span>;
  if (yesterday === 0) return <span>No sales yesterday</span>;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? "text-emerald-700" : "text-gray-500"}>
      {up ? "Up" : "Down"} {Math.abs(pct)}% vs yesterday
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { stock } = useStock();

  const role = appUser?.role ?? "sales_rep";
  const isDriver = (role as string) === "driver";
  const isAdmin = role === "admin";
  const uid = appUser?.uid;

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [chequesOk, setChequesOk] = useState(true);
  const [ucReturns, setUcReturns] = useState<UCRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ---------------- data ---------------- */

  useEffect(() => {
    if (isDriver) { setLoading(false); return; }
    if (!uid) return;
    let cancelled = false;

    async function load() {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const weekStart = startOfDay(new Date(now.getTime() - 6 * DAY));
      const from = monthStart < weekStart ? monthStart : weekStart;

      const [invRes, cheqRes, ucRes] = await Promise.allSettled([
        getDocs(query(
          collection(db, "invoices"),
          where("invoiceDate", ">=", Timestamp.fromDate(from)),
          orderBy("invoiceDate", "desc")
        )),
        getDocs(query(collection(db, "cheques"), where("status", "==", "pending"))),
        getDocs(collection(db, "ucReturns")),
      ]);

      if (cancelled) return;

      if (invRes.status === "fulfilled") {
        setInvoices(
          invRes.value.docs
            .map(d => ({ ...(d.data() as InvoiceRow), id: d.id }))
            .filter(i => i.status === "confirmed")
        );
      }

      setChequesOk(cheqRes.status === "fulfilled");
      if (cheqRes.status === "fulfilled") {
        setCheques(cheqRes.value.docs.map(d => ({ ...(d.data() as ChequeRow), id: d.id })));
      }

      if (ucRes.status === "fulfilled") {
        setUcReturns(
          ucRes.value.docs
            .map(d => ({ ...(d.data() as UCRow), id: d.id }))
            .filter(r => r.status !== "closed")
        );
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [uid, isDriver]);

  /* ---------------- derived: sales ---------------- */

  const sales = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const days = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(todayStart);
      start.setDate(start.getDate() - (6 - i));
      return { start, total: 0 };
    });

    let today = 0;
    let yesterday = 0;
    let month = 0;
    let monthCount = 0;
    const mix = { cash: 0, card: 0, cheque: 0, pending: 0 };

    for (const inv of invoices) {
      const d = toDate(inv.invoiceDate);
      if (!d) continue;
      const amount = Number(inv.totalAmount) || 0;

      if (d >= todayStart) today += amount;
      else if (d >= yesterdayStart) yesterday += amount;

      if (d >= monthStart) {
        month += amount;
        monthCount += 1;
        const type = inv.paymentType ?? "";
        if (type === "cash") mix.cash += amount;
        else if (type === "card") mix.card += amount;
        else if (type.startsWith("cheque")) mix.cheque += amount;
        else if (type === "pending") mix.pending += amount;
      }

      const idx = dayDiff(d, days[0].start);
      if (idx >= 0 && idx < 7) days[idx].total += amount;
    }

    return { today, yesterday, month, monthCount, mix, days };
  }, [invoices]);

  /* ---------------- derived: cheques ---------------- */

  const chequeStats = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const soonEnd = new Date(todayStart);
    soonEnd.setDate(soonEnd.getDate() + 3);

    let total = 0;
    const overdue: { row: ChequeRow; due: Date }[] = [];
    const soon: { row: ChequeRow; due: Date }[] = [];

    for (const c of cheques) {
      total += Number(c.amount) || 0;
      const due = toDate(c.dueDate);
      if (!due) continue;
      if (due < todayStart) overdue.push({ row: c, due });
      else if (due < soonEnd) soon.push({ row: c, due });
    }
    return { total, count: cheques.length, overdue, soon };
  }, [cheques]);

  /* ---------------- derived: stock ---------------- */

  const stockStats = useMemo(() => {
    let units = 0;
    const out: string[] = [];
    const low: string[] = [];
    for (const s of stock) {
      const qty = typeof s.qty === "number" ? s.qty : 0;
      const reorder = typeof s.reorderLevel === "number" ? s.reorderLevel : 10;
      units += qty;
      if (qty === 0) out.push(s.productName);
      else if (qty <= reorder) low.push(s.productName);
    }
    return { units, out, low };
  }, [stock]);

  /* ---------------- derived: UC returns ---------------- */

  const ucStats = useMemo(() => {
    const today = startOfDay(new Date());
    const waiting = ucReturns.filter(r => {
      if (r.status !== "approved") return false;
      const d = toDate(r.tyreReceivedAt);
      return !!d && dayDiff(today, d) >= 3;
    });
    const late = ucReturns.filter(r => {
      if (r.status !== "sent_to_supplier" && r.status !== "awaiting_replacement") return false;
      const d = toDate(r.sentToSupplierAt);
      return !!d && dayDiff(today, d) >= 30;
    });
    return { waiting, late };
  }, [ucReturns]);

  /* ---------------- derived: attention list ---------------- */

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const today = startOfDay(new Date());

    if (isAdmin && chequeStats.overdue.length > 0) {
      const amount = chequeStats.overdue.reduce((s, x) => s + (Number(x.row.amount) || 0), 0);
      const oldest = Math.max(...chequeStats.overdue.map(x => dayDiff(today, x.due)));
      items.push({
        id: "cheque-overdue",
        tone: "danger",
        title: `${plural(chequeStats.overdue.length, "cheque")} overdue`,
        detail: `${formatLKR(amount)} · oldest is ${plural(oldest, "day")} late`,
        href: "/dashboard/cheques",
      });
    }

    if (stockStats.out.length > 0) {
      items.push({
        id: "stock-out",
        tone: "danger",
        title: `${plural(stockStats.out.length, "item")} out of stock`,
        detail: nameList(stockStats.out),
        href: "/dashboard/inventory",
      });
    }

    if (ucStats.late.length > 0) {
      items.push({
        id: "uc-late",
        tone: "danger",
        title: `${plural(ucStats.late.length, "return")} with CEAT for 30+ days`,
        detail: `Follow up on replacements · ${nameList(ucStats.late.map(r => r.shopName ?? ""))}`,
        href: "/dashboard/uc-returns",
      });
    }

    if (isAdmin && chequeStats.soon.length > 0) {
      const amount = chequeStats.soon.reduce((s, x) => s + (Number(x.row.amount) || 0), 0);
      items.push({
        id: "cheque-soon",
        tone: "warning",
        title: `${plural(chequeStats.soon.length, "cheque")} due in the next 2 days`,
        detail: `${formatLKR(amount)} · ${nameList(chequeStats.soon.map(x => x.row.shopName ?? ""))}`,
        href: "/dashboard/cheques",
      });
    }

    if (stockStats.low.length > 0) {
      items.push({
        id: "stock-low",
        tone: "warning",
        title: `${plural(stockStats.low.length, "item")} running low`,
        detail: nameList(stockStats.low),
        href: "/dashboard/inventory",
      });
    }

    if (ucStats.waiting.length > 0) {
      items.push({
        id: "uc-waiting",
        tone: "warning",
        title: `${plural(ucStats.waiting.length, "UC tyre")} waiting to go to CEAT`,
        detail: nameList(ucStats.waiting.map(r => r.shopName ?? "")),
        href: "/dashboard/uc-returns",
      });
    }

    return items;
  }, [isAdmin, chequeStats, stockStats, ucStats]);

  /* ---------------- display values ---------------- */

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = appUser?.displayName?.trim().split(" ").slice(-1)[0] || "there";
  const dateLabel = now.toLocaleDateString("en-LK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const newInvoice = (
    <Link
      href="/dashboard/invoices/new"
      className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 sm:h-10"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      New invoice
    </Link>
  );

  /* ---------------- driver view ---------------- */

  if (isDriver) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <PageHeader eyebrow={dateLabel} title={`${greeting}, ${firstName}`} />
        <Panel
          title="Deliveries"
          description="Mark each stop as delivered or skipped from the dispatch page"
        >
          <Link
            href="/dashboard/dispatch"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <Truck className="h-4 w-4" aria-hidden="true" />
            Open dispatch
          </Link>
        </Panel>
      </div>
    );
  }

  /* ---------------- admin / sales rep view ---------------- */

  const needRestock = stockStats.out.length + stockStats.low.length;
  const weekTotal = sales.days.reduce((s, d) => s + d.total, 0);
  const maxDay = Math.max(...sales.days.map(d => d.total), 1);
  const recent = invoices.slice(0, 6);

  const kpis: StatItem[] = [
    {
      label: "Today's sales",
      value: formatLKR(sales.today),
      hint: deltaHint(sales.today, sales.yesterday),
    },
    {
      label: "This month",
      value: formatLKR(sales.month),
      hint: plural(sales.monthCount, "invoice"),
    },
    {
      label: "Cheques pending",
      value: chequesOk ? formatLKR(chequeStats.total) : "-",
      hint: chequesOk ? plural(chequeStats.count, "cheque") : "Could not load",
    },
    {
      label: "Stock on hand",
      value: stockStats.units.toLocaleString("en-LK"),
      hint: (
        <>
          {plural(stock.length, "SKU")}
          {needRestock > 0 && (
            <span className="text-amber-700"> · {needRestock} need restocking</span>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${firstName}`}
        actions={newInvoice}
      />

      {/* Needs attention */}
      <Panel
        title="Needs attention"
        description={
          loading
            ? "Checking cheques, stock and returns"
            : attention.length === 0
              ? "Nothing urgent right now"
              : `${plural(attention.length, "item")} to review`
        }
        flush
        className="mb-6"
      >
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1].map(i => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : attention.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-4 text-sm text-gray-600">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
            Cheques, stock and returns are all on track.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {attention.map(item => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span
                    className={cn(
                      "h-2 w-2 flex-shrink-0 rounded-full",
                      item.tone === "danger" ? "bg-red-500" : "bg-amber-500"
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      <span className="sr-only">
                        {item.tone === "danger" ? "Urgent: " : "Review: "}
                      </span>
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-gray-500">{item.detail}</p>
                  </div>
                  <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-medium text-brand-700 group-hover:underline">
                    Review
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* KPIs */}
      <StatStrip items={kpis} loading={loading} />

      {/* Chart + recent invoices */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Panel title="Sales, last 7 days" description={`${formatLKR(weekTotal)} in total`}>
            <div
              className="flex h-44 items-end gap-2 sm:gap-3"
              role="img"
              aria-label={`Daily sales for the last 7 days, ${formatLKR(weekTotal)} in total`}
            >
              {sales.days.map((d, i) => {
                const isToday = i === 6;
                const barHeight = d.total > 0 ? Math.max(6, Math.round((d.total / maxDay) * 104)) : 2;
                const weekday = d.start.toLocaleDateString("en-LK", { weekday: "short" });
                return (
                  <div
                    key={i}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  >
                    <span
                      className={cn(
                        "h-4 text-[11px] leading-4 tabular-nums",
                        isToday ? "font-semibold text-gray-900" : "text-gray-500"
                      )}
                    >
                      {d.total > 0 ? compact(d.total) : "\u00A0"}
                    </span>
                    <div
                      title={`${weekday}: ${formatLKR(d.total)}`}
                      className={cn(
                        "w-full max-w-[48px] rounded-t-md",
                        isToday ? "bg-brand-600" : d.total > 0 ? "bg-gray-300" : "bg-gray-200"
                      )}
                      style={{ height: barHeight }}
                    />
                    <span
                      className={cn(
                        "h-4 text-[11px] leading-4",
                        isToday ? "font-semibold text-gray-900" : "text-gray-500"
                      )}
                    >
                      {isToday ? "Today" : weekday}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Payment mix" description="This month">
            <PaymentMix {...sales.mix} />
          </Panel>
        </div>

        <Panel
          title="Recent invoices"
          flush
          className="self-start lg:col-span-2"
          action={
            <Link href="/dashboard/invoices" className="text-xs font-medium text-brand-700 hover:underline">
              View all
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-gray-600">No invoices this month yet</p>
              <Link
                href="/dashboard/invoices/new"
                className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Create an invoice
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map(inv => (
                <li key={inv.id}>
                  <Link
                    href={`/dashboard/invoices/${inv.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{inv.shopName}</p>
                      <p className="truncate text-xs text-gray-500">
                        {inv.invoiceNo} · {whenLabel(toDate(inv.invoiceDate))}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-gray-900">
                        {formatLKR(Number(inv.totalAmount) || 0)}
                      </p>
                      <p className="text-xs text-gray-500">{paymentLabel(inv.paymentType)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}