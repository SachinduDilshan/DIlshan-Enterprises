"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value:    string;
  onChange: (value: string) => void;
  options:  DropdownOption[];
  className?: string;
}

export function Dropdown({ value, onChange, options, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className={cn("relative w-full max-w-full min-w-0", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full max-w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <span className="truncate">{selected?.label ?? "Select..."}</span>
        <ChevronDown className={cn("h-4 w-4 text-gray-400 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-full min-w-[160px] max-w-[calc(100vw-2rem)] rounded-xl border border-gray-100 bg-white shadow-lg overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm text-left hover:bg-gray-50 transition-colors",
                opt.value === value ? "text-brand-700 font-medium bg-brand-50" : "text-gray-700"
              )}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}