"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  query, orderBy, onSnapshot, Timestamp,
} from "firebase/firestore";
import { dispatchesCol } from "@/lib/firestore-collections";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import { Plus, Truck, ChevronRight, CheckCircle, Clock, XCircle } from "lucide-react";
import type { Dispatch, DispatchStatus } from "@/types";

const STATUS_META: Record<DispatchStatus, { label: string; variant: "default"|"info"|"success"|"danger"|"warning" }> = {
  planned:     { label: "Planned",     variant: "default"  },
  in_progress: { label: "In progress", variant: "info"     },
  completed:   { label: "Completed",   variant: "success"  },
  cancelled:   { label: "Cancelled",   variant: "danger"   },
};

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const q = query(dispatchesCol, orderBy("dispatchDate", "desc"));
    const unsub = onSnapshot(q, snap => {
      setDispatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Dispatch)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const active   = dispatches.filter(d => d.status === "planned" || d.status === "in_progress");
  const past     = dispatches.filter(d => d.status === "completed" || d.status === "cancelled");

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900">Dispatch</h1>
          <p className="text-sm text-gray-500">Lorry delivery management</p>
        </div>
        <Link href="/dashboard/dispatch/new">
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Plan dispatch
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
        </div>
      )}

      {!loading && dispatches.length === 0 && (
        <Card className="flex flex-col items-center py-12 text-center">
          <Truck className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">No dispatches yet</p>
          <Link href="/dashboard/dispatch/new" className="mt-4">
            <Button size="sm">Plan first dispatch</Button>
          </Link>
        </Card>
      )}

      {active.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Active</h2>
          {active.map(d => (
            <DispatchCard key={d.id} dispatch={d} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3 mt-5">Past dispatches</h2>
          {past.map(d => (
            <DispatchCard key={d.id} dispatch={d} />
          ))}
        </>
      )}
    </div>
  );
}

function DispatchCard({ dispatch: d }: { dispatch: Dispatch }) {
  const meta = STATUS_META[d.status];
  return (
    <Link href={`/dashboard/dispatch/${d.id}`}>
      <Card className="mb-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0",
          d.status === "completed" ? "bg-green-50" :
          d.status === "in_progress" ? "bg-blue-50" : "bg-gray-100"
        )}>
          <Truck className={cn("h-5 w-5",
            d.status === "completed" ? "text-green-600" :
            d.status === "in_progress" ? "text-blue-600" : "text-gray-400"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900">{d.lorryReg}</p>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <p className="text-xs text-gray-500">
            {d.fromWarehouseName} · {d.totalStops} stops · {d.totalUnits} tyres · {formatDate(d.dispatchDate)}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </Card>
    </Link>
  );
}
