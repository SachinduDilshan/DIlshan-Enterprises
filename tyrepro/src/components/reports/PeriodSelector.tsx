"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
  { value: "lastyear", label: "Last year" },
  { value: "alltime", label: "All time" },
];

export function getDateRange(
  range: string,
  customFrom?: string,
  customTo?: string
): {
  start: Date;
  end: Date;
  label: string;
} {
  const now = new Date();

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (range) {
    case "today":
      return {
        start,
        end,
        label: "Today",
      };

    case "yesterday": {
      const s = new Date(now);
      s.setDate(now.getDate() - 1);
      s.setHours(0, 0, 0, 0);

      const e = new Date(now);
      e.setDate(now.getDate() - 1);
      e.setHours(23, 59, 59, 999);

      return {
        start: s,
        end: e,
        label: "Yesterday",
      };
    }

    case "week": {
      const s = new Date(now);
      s.setDate(now.getDate() - 6);
      s.setHours(0, 0, 0, 0);

      return {
        start: s,
        end,
        label: "Last 7 days",
      };
    }

    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end,
        label: "This month",
      };

    case "lastmonth": {
      const s = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1
      );

      const e = new Date(
        now.getFullYear(),
        now.getMonth(),
        0
      );

      e.setHours(23, 59, 59, 999);

      return {
        start: s,
        end: e,
        label: "Last month",
      };
    }

    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;

      return {
        start: new Date(now.getFullYear(), q, 1),
        end,
        label: "This quarter",
      };
    }

    case "year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end,
        label: `This year (${now.getFullYear()})`,
      };

    case "lastyear": {
      const y = now.getFullYear() - 1;

      const e = new Date(y, 11, 31);
      e.setHours(23, 59, 59, 999);

      return {
        start: new Date(y, 0, 1),
        end: e,
        label: `Last year (${y})`,
      };
    }

    case "alltime":
      return {
        start: new Date(2020, 0, 1),
        end,
        label: "All time",
      };

    case "custom": {
      const s = customFrom
        ? new Date(customFrom)
        : new Date(now.getFullYear(), now.getMonth(), 1);

      const e = customTo
        ? new Date(customTo)
        : new Date(now);

      s.setHours(0, 0, 0, 0);
      e.setHours(23, 59, 59, 999);

      return {
        start: s,
        end: e,
        label: `${s.toLocaleDateString("en-LK", {
          day: "2-digit",
          month: "short",
        })} – ${e.toLocaleDateString("en-LK", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}`,
      };
    }

    default:
      return {
        start,
        end,
        label: "This month",
      };
  }
}

interface PeriodSelectorProps {
  value: string;
  onChange: (v: string) => void;

  customFrom: string;
  customTo: string;

  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;
}

export function PeriodSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  /* ---------------------------------------------------------
     Detect mobile
  --------------------------------------------------------- */
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  /* ---------------------------------------------------------
     Desktop outside click
     IMPORTANT:
     Do NOT use this for mobile because mobile sheet is
     rendered through a portal outside `ref`.
  --------------------------------------------------------- */
  useEffect(() => {
    if (!open || isMobile) return;

    function handleClick(e: MouseEvent) {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, isMobile]);

  /* ---------------------------------------------------------
     Prevent background scrolling while mobile sheet is open
  --------------------------------------------------------- */
  useEffect(() => {
    if (!open || !isMobile) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  /* ---------------------------------------------------------
     Selected label
  --------------------------------------------------------- */
  const selectedLabel =
    value === "custom"
      ? customFrom && customTo
        ? `${new Date(customFrom).toLocaleDateString("en-LK", {
            day: "2-digit",
            month: "short",
          })} – ${new Date(customTo).toLocaleDateString("en-LK", {
            day: "2-digit",
            month: "short",
          })}`
        : "Custom range"
      : PRESETS.find((p) => p.value === value)?.label ??
        "Select period";

  /* ---------------------------------------------------------
     Handlers
  --------------------------------------------------------- */
  const handlePresetChange = (v: string) => {
    onChange(v);

    if (v !== "custom") {
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange("month");
    onCustomFromChange("");
    onCustomToChange("");
    setOpen(false);
  };

  /* ---------------------------------------------------------
     Period panel
  --------------------------------------------------------- */
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
      {/* =====================================================
          SELECTOR BUTTON
      ===================================================== */}
      <div
        ref={ref}
        className="relative inline-block"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center gap-2",
            "rounded-xl border",
            "px-3 py-2",
            "text-sm font-medium",
            "transition-colors",
            "whitespace-nowrap",
            open
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
          )}
        >
          <Calendar className="h-4 w-4 shrink-0" />

          <span className="max-w-[150px] truncate sm:max-w-none">
            {selectedLabel}
          </span>

          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {/* ===================================================
            DESKTOP DROPDOWN
        =================================================== */}
        {open && !isMobile && (
          <div
            className="
              absolute
              right-0
              top-full
              z-[1000]
              mt-2
              w-64
              overflow-hidden
              rounded-2xl
              border
              border-gray-100
              bg-white
              shadow-xl
            "
          >
            {panel}
          </div>
        )}
      </div>

      {/* =====================================================
          MOBILE BOTTOM SHEET
          
          IMPORTANT:
          Render directly into document.body.
          This prevents Reports/parent overflow styles from
          clipping the selector.
      ===================================================== */}
      {open &&
        isMobile &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="
              fixed
              inset-0
              z-[99999]
              flex
              items-end
              justify-center
              bg-black/40
            "
            onClick={() => setOpen(false)}
          >
            <div
              className="
                w-full
                max-h-[75dvh]
                overflow-hidden
                rounded-t-3xl
                bg-white
                shadow-2xl
              "
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="flex justify-center pb-2 pt-3">
                <div className="h-1 w-10 rounded-full bg-gray-200" />
              </div>

              {/* Header */}
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-gray-100
                  px-5
                  pb-3
                "
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Select period
                  </p>

                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Choose a reporting period
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    transition-colors
                    hover:bg-gray-50
                    active:bg-gray-100
                  "
                  aria-label="Close period selector"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              {/* Scrollable panel */}
              <div
                className="
                  max-h-[calc(75dvh-76px)]
                  overflow-y-auto
                  overscroll-contain
                "
                style={{
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {panel}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/* ============================================================
   PERIOD PANEL
============================================================ */

function PeriodPanel({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;

  customFrom: string;
  customTo: string;

  onCustomFromChange: (v: string) => void;
  onCustomToChange: (v: string) => void;

  onClear: () => void;
}) {
  return (
    <div className="w-full">
      {/* =====================================================
          QUICK SELECT
      ===================================================== */}
      <div className="p-4">
        <p
          className="
            mb-2.5
            text-[10px]
            font-semibold
            uppercase
            tracking-wider
            text-gray-400
          "
        >
          Quick select
        </p>

        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const selected =
              value === preset.value &&
              value !== "custom";

            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => onChange(preset.value)}
                className={cn(
                  "min-w-0",
                  "rounded-xl",
                  "border",
                  "px-2",
                  "py-3",
                  "text-center",
                  "text-xs",
                  "font-medium",
                  "leading-tight",
                  "transition-colors",
                  "active:scale-[0.98]",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white"
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gray-100" />

      {/* =====================================================
          CUSTOM RANGE
      ===================================================== */}
      <div className="p-4">
        <button
          type="button"
          onClick={() => onChange("custom")}
          className={cn(
            "flex w-full items-center gap-2",
            "rounded-xl border",
            "px-3 py-3",
            "text-left text-xs font-medium",
            "transition-colors",
            value === "custom"
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-dashed border-gray-300 text-gray-500 hover:border-brand-300 hover:text-brand-600"
          )}
        >
          <Calendar className="h-4 w-4 shrink-0" />

          <span>Custom date range</span>
        </button>

        {value === "custom" && (
          <div className="mt-3 flex items-end gap-2">
            {/* From */}
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-brand-600">
                From
              </label>

              <input
                type="date"
                value={customFrom}
                onChange={(e) =>
                  onCustomFromChange(e.target.value)
                }
                className="
                  w-full
                  min-w-0
                  rounded-xl
                  border
                  border-brand-200
                  bg-white
                  px-2
                  py-2.5
                  text-xs
                  text-gray-900
                  outline-none
                  focus:border-brand-400
                  focus:ring-2
                  focus:ring-brand-100
                "
              />
            </div>

            {/* Arrow */}
            <span className="mb-2 shrink-0 text-sm text-gray-400">
              →
            </span>

            {/* To */}
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[10px] font-semibold text-brand-600">
                To
              </label>

              <input
                type="date"
                value={customTo}
                max={new Date()
                  .toISOString()
                  .split("T")[0]}
                onChange={(e) =>
                  onCustomToChange(e.target.value)
                }
                className="
                  w-full
                  min-w-0
                  rounded-xl
                  border
                  border-brand-200
                  bg-white
                  px-2
                  py-2.5
                  text-xs
                  text-gray-900
                  outline-none
                  focus:border-brand-400
                  focus:ring-2
                  focus:ring-brand-100
                "
              />
            </div>
          </div>
        )}

        {value === "custom" &&
          customFrom &&
          customTo && (
            <button
              type="button"
              onClick={onClear}
              className="
                mt-3
                text-xs
                text-gray-400
                underline
                transition-colors
                hover:text-gray-600
              "
            >
              Clear custom range
            </button>
          )}
      </div>
    </div>
  );
}