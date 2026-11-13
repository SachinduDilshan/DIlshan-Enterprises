"use client";

{/* 
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
import { Plus, Truck, ChevronRight } from "lucide-react";
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
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Dispatch, "id">),
      }));
      setDispatches(docs as Dispatch[]);
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
          <h1 className="text-xl font-medium text-gray-900">DISPATCH</h1>
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
*/}


import {
  Truck,
  MapPin,
  ClipboardList,
  Navigation,
  Clock,
  ArrowRight,
  PackageCheck,
} from "lucide-react";

const UPCOMING_FEATURES = [
  {
    icon: ClipboardList,
    title: "Dispatch Planning",
    description:
      "Create lorry dispatch plans and organise multiple shop deliveries.",
  },
  {
    icon: MapPin,
    title: "Multiple Delivery Stops",
    description:
      "Manage delivery destinations and organise stops within a single trip.",
  },
  {
    icon: Navigation,
    title: "Driver Management",
    description:
      "Provide drivers with their assigned delivery schedules and destinations.",
  },
  {
    icon: PackageCheck,
    title: "Delivery Tracking",
    description:
      "Track completed and pending deliveries with real-time status updates.",
  },
];

export default function DispatchPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">
          Dispatch
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Delivery management
        </p>
      </div>

      {/* Coming Soon Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">

        {/* Decorative Background */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-50 opacity-70 blur-3xl" />

        <div className="relative px-6 py-12 text-center sm:px-12 sm:py-16">

          {/* Truck Icon */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200">
            <Truck className="h-10 w-10 text-white" strokeWidth={1.6} />
          </div>

          {/* Status Badge */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Coming Soon
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Dispatch Management
            <br />
            <span className="text-indigo-600">
              Is Coming Soon
            </span>
          </h2>

          {/* Description */}
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-500 sm:text-base">
            We are preparing a smarter way to manage lorry
            deliveries, organise delivery routes, and track
            shop orders. This module will be introduced as
            part of a future operational rollout at
            Dilshan Enterprises.
          </p>

          {/* Divider */}
          <div className="mx-auto my-8 h-px max-w-md bg-gray-100" />

          {/* Feature Preview Heading */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-900">
              What's Coming
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              A preview of upcoming dispatch capabilities
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">

            {UPCOMING_FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-4 transition-all duration-200 hover:border-indigo-100 hover:bg-indigo-50/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                    <Icon className="h-5 w-5 text-indigo-600" />
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800">
                      {feature.title}
                    </h4>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}

          </div>

          {/* Footer Notice */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Clock className="h-4 w-4" />
            <span>
              This module will be available in a future rollout.
            </span>
          </div>

        </div>
      </div>

      {/* Bottom Information */}
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <ArrowRight className="h-4 w-4 text-indigo-600" />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-800">
            More efficient deliveries are on the way.
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Other TyrePro modules remain available for daily
            business operations.
          </p>
        </div>
      </div>

    </div>
  );
}