"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today",     label: "Today"        },
  { value: "yesterday", label: "Yesterday"    },
  { value: "week",      label: "Last 7 days"  },
  { value: "month",     label: "This month"   },
  { value: "lastmonth", label: "Last month"   },
  { value: "quarter",   label: "This quarter" },
  { value: "year",      label: "This year"    },
  { value: "lastyear",  label: "Last year"    },
  { value: "alltime",   label: "All time"     },
];

export function getDateRange(
  range: string,
  customFrom?: string,
  customTo?: string
): { start: Date; end: Date; label: string } {
  const now   = new Date();
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return { start, end, label: "Today" };

    case "yesterday": {
      const s = new Date(now); s.setDate(now.getDate() - 1); s.setHours(0, 0, 0, 0);
      const e = new Date(now); e.setDate(now.getDate() - 1); e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: "Yesterday" };
    }

    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
      return { start: s, end, label: "Last 7 days" };
    }

    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, label: "This month" };

    case "lastmonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); e.setHours(23, 59, 59, 999);
      return { start: s, end: e, label: "Last month" };
    }

    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), q, 1), end, label: "This quarter" };
    }

    case "year":
      return { start: new Date(now.getFullYear(), 0, 1), end, label: `This year (${now.getFullYear()})` };

    case "lastyear": {
      const y = now.getFullYear() - 1;
      const e = new Date(y, 11, 31); e.setHours(23, 59, 59, 999);
      return { start: new Date(y, 0, 1), end: e, label: `Last year (${y})` };
    }

    case "alltime":
      return { start: new Date(2020, 0, 1), end, label: "All time" };

    case "custom": {
      const s = customFrom
        ? new Date(customFrom)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = customTo ? new Date(customTo) : new Date(now);
      s.setHours(0, 0, 0, 0); e.setHours(23, 59, 59, 999);
      return {
        start: s, end: e,
        label: `${s.toLocaleDateString("en-LK", { day: "2-digit", month: "short" })} – ${e.toLocaleDateString("en-LK", { day: "2-digit", month: "short", year: "numeric" })}`,
      };
    }

    default:
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, label: "This month" };
  }
}

// ── Period panel (shared between desktop + mobile) ────────

function PeriodPanel({
  value, onChange, customFrom, customTo,
  onCustomFromChange, onCustomToChange, onClear,
}: {
  value: string; onChange: (v: string) => void;
  customFrom: string; customTo: string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange:   (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="w-full">
      {/* Quick select */}
      <div className="p-4">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Quick select
        </p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(preset => {
            const selected = value === preset.value && value !== "custom";
            return (
              <button key={preset.value} type="button"
                onClick={() => onChange(preset.value)}
                className={cn(
                  "min-w-0 rounded-xl border px-2 py-3 text-center text-xs font-medium",
                  "leading-tight transition-colors active:scale-[0.98]",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white"
                )}>
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-4 h-px bg-gray-100" />

      {/* Custom range — stacked layout so no horizontal overflow */}
      <div className="p-4">
        <button type="button" onClick={() => onChange("custom")}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl border px-3 py-3",
            "text-left text-xs font-medium transition-colors",
            value === "custom"
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600"
          )}>
          <Calendar className="h-4 w-4 shrink-0" />
          <span>Custom date range</span>
        </button>

        {value === "custom" && (
          <div className="mt-3 space-y-2">
            {/* From — full width, stacked */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-brand-600">
                From
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={e => onCustomFromChange(e.target.value)}
                className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {/* To — full width, stacked */}
            <div>
              <label className="mb-1 block text-[10px] font-semibold text-brand-600">
                To
              </label>
              <input
                type="date"
                value={customTo}
                max={new Date().toISOString().split("T")[0]}
                onChange={e => onCustomToChange(e.target.value)}
                className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
            </div>

            {customFrom && customTo && (
              <button type="button" onClick={onClear}
                className="text-xs text-gray-400 underline transition-colors hover:text-gray-600">
                Clear custom range
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────

interface PeriodSelectorProps {
  value:              string;
  onChange:           (v: string) => void;
  customFrom:         string;
  customTo:           string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange:   (v: string) => void;
}

export function PeriodSelector({
  value, onChange, customFrom, customTo,
  onCustomFromChange, onCustomToChange,
}: PeriodSelectorProps) {
  const [open, setOpen]         = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const ref                     = useRef<HTMLDivElement>(null);

  // Detect mobile
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 640); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Desktop outside click
  useEffect(() => {
    if (!open || isMobile) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, isMobile]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  const selectedLabel = value === "custom"
    ? customFrom && customTo
      ? `${new Date(customFrom).toLocaleDateString("en-LK", { day: "2-digit", month: "short" })} – ${new Date(customTo).toLocaleDateString("en-LK", { day: "2-digit", month: "short" })}`
      : "Custom range"
    : PRESETS.find(p => p.value === value)?.label ?? "Select period";

  function handlePresetChange(v: string) {
    onChange(v);
    if (v !== "custom") setOpen(false);
  }

  function handleClear() {
    onChange("month");
    onCustomFromChange("");
    onCustomToChange("");
    setOpen(false);
  }

  const panel = (
    <PeriodPanel
      value={value}
      onChange={handlePresetChange}
      customFrom={customFrom}
      customTo={customTo}
      onCustomFromChange={onCustomFromChange}
      onCustomToChange={onCustomToChange}
      onClear={handleClear}
    />
  );

  return (
    <>
      <div ref={ref} className="relative inline-block">
        {/* Trigger button */}
        <button type="button" onClick={() => setOpen(v => !v)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium",
            "whitespace-nowrap transition-colors",
            open
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          )}>
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="max-w-[150px] truncate sm:max-w-none">{selectedLabel}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
        </button>

        {/* Desktop dropdown */}
        {open && !isMobile && (
          <div className="absolute right-0 top-full z-[1000] mt-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
            style={{ width: "min(280px, calc(100vw - 2rem))" }}>
            {panel}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet — portal so nothing clips it */}
      {open && isMobile && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-h-[80dvh] overflow-hidden rounded-t-3xl bg-white shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-gray-200" />
            </div>

            {/* Sheet header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 pb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Select period</p>
                <p className="mt-0.5 text-[11px] text-gray-400">Choose a reporting period</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                aria-label="Close">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {panel}
              <div className="h-6" />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}