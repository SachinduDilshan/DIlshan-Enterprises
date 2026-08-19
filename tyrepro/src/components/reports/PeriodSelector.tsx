"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
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

export function getDateRange(range: string, customFrom?: string, customTo?: string): {
  start: Date; end: Date; label: string;
} {
  const now   = new Date();
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  const start = new Date(now); start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return { start, end, label: "Today" };
    case "yesterday": {
      const s = new Date(now); s.setDate(now.getDate() - 1); s.setHours(0,0,0,0);
      const e = new Date(now); e.setDate(now.getDate() - 1); e.setHours(23,59,59,999);
      return { start: s, end: e, label: "Yesterday" };
    }
    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0,0,0,0);
      return { start: s, end, label: "Last 7 days" };
    }
    case "month": {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end, label: "This month" };
    }
    case "lastmonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0); e.setHours(23,59,59,999);
      return { start: s, end: e, label: "Last month" };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), q, 1), end, label: "This quarter" };
    }
    case "year": {
      return { start: new Date(now.getFullYear(), 0, 1), end, label: `This year (${now.getFullYear()})` };
    }
    case "lastyear": {
      const y = now.getFullYear() - 1;
      const e = new Date(y, 11, 31); e.setHours(23,59,59,999);
      return { start: new Date(y, 0, 1), end: e, label: `Last year (${y})` };
    }
    case "alltime": {
      return { start: new Date(2020, 0, 1), end, label: "All time" };
    }
    case "custom": {
      const s = customFrom ? new Date(customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      const e = customTo   ? new Date(customTo)   : new Date(now);
      s.setHours(0,0,0,0); e.setHours(23,59,59,999);
      return {
        start: s, end: e,
        label: `${s.toLocaleDateString("en-LK",{day:"2-digit",month:"short"})} – ${e.toLocaleDateString("en-LK",{day:"2-digit",month:"short",year:"numeric"})}`,
      };
    }
    default:
      return { start, end, label: "This month" };
  }
}

interface PeriodSelectorProps {
  value:              string;
  onChange:           (v: string) => void;
  customFrom:         string;
  customTo:           string;
  onCustomFromChange: (v: string) => void;
  onCustomToChange:   (v: string) => void;
}

export function PeriodSelector({
  value, onChange, customFrom, customTo, onCustomFromChange, onCustomToChange,
}: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedLabel = value === "custom"
    ? customFrom && customTo
      ? `${new Date(customFrom).toLocaleDateString("en-LK",{day:"2-digit",month:"short"})} – ${new Date(customTo).toLocaleDateString("en-LK",{day:"2-digit",month:"short"})}`
      : "Custom range"
    : PRESETS.find(p => p.value === value)?.label ?? "Select period";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
          open
            ? "border-brand-400 bg-brand-50 text-brand-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
        )}
      >
        <Calendar className="h-4 w-4 flex-shrink-0" />
        <span>{selectedLabel}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden">
          <div className="p-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
              Quick select
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map(p => (
                <button key={p.value}
                  onClick={() => { onChange(p.value); if (p.value !== "custom") setOpen(false); }}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors text-center",
                    value === p.value && value !== "custom"
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white hover:text-gray-900"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100 mx-3" />

          <div className="p-3">
            <button
              onClick={() => onChange("custom")}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                value === "custom"
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600"
              )}
            >
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              Custom date range
            </button>

            {value === "custom" && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-medium text-brand-600 block mb-1">From</label>
                  <input type="date" value={customFrom}
                    onChange={e => onCustomFromChange(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-brand-400" />
                </div>
                <span className="text-gray-400 text-sm mt-4">→</span>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-medium text-brand-600 block mb-1">To</label>
                  <input type="date" value={customTo}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => onCustomToChange(e.target.value)}
                    className="w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-brand-400" />
                </div>
              </div>
            )}

            {value === "custom" && customFrom && customTo && (
              <button
                onClick={() => { onChange("month"); onCustomFromChange(""); onCustomToChange(""); setOpen(false); }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Clear custom range
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}