"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value:       string;
  onChange:    (value: string) => void;
  options:     DropdownOption[];
  label?:      string;
  placeholder?: string;
  error?:      string;
  hint?:       string;
  disabled?:   boolean;
  className?:  string;
}

export function Dropdown({
  value,
  onChange,
  options,
  label,
  placeholder,
  error,
  hint,
  disabled = false,
  className,
}: DropdownProps) {
  const [open, setOpen]   = useState(false);
  const [above, setAbove] = useState(false);
  const ref               = useRef<HTMLDivElement>(null);
  const btnRef            = useRef<HTMLButtonElement>(null);

  const selected = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Decide whether to open above or below based on available space
  function handleOpen() {
    if (disabled) return;
    if (!open && btnRef.current) {
      const rect       = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setAbove(spaceBelow < 220 && spaceAbove > spaceBelow);
    }
    setOpen(v => !v);
  }

  return (
    <div className={cn("relative w-full max-w-full min-w-0", className)} ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm text-left transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-brand-100",
          open
            ? "border-brand-400 ring-2 ring-brand-100"
            : "border-gray-200 hover:border-gray-300",
          error && "border-red-400",
          disabled && "bg-gray-50 cursor-not-allowed text-gray-400"
        )}
      >
        <span className={cn("truncate flex-1 text-left", !selected && "text-gray-400")}>
          {selected?.label ?? placeholder ?? "Select..."}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-gray-400 flex-shrink-0 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute left-0 right-0 z-[200] w-full min-w-[140px]",
            "max-w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl",
            above ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          {placeholder && (
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2.5 text-sm text-left text-gray-400 hover:bg-gray-50 transition-colors border-b border-gray-50"
              )}
            >
              <span className="truncate">{placeholder}</span>
            </button>
          )}
          <div className="max-h-56 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors",
                  opt.value === value
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <span className="truncate flex-1">{opt.label}</span>
                {opt.value === value && (
                  <Check className="h-3.5 w-3.5 text-brand-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {hint  && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}