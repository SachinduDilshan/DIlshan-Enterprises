"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title:     string;
  subtitle?: string;
  onClose:   () => void;
  children:  React.ReactNode;
  size?:     "sm" | "md" | "lg";
}

export function Modal({ title, subtitle, onClose, children, size = "md" }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const maxW = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" }[size];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className={cn(
          // Full width, rounded top on mobile, rounded all on desktop
          "w-full bg-white",
          "rounded-t-3xl sm:rounded-2xl",
          // On mobile: sit at bottom, max 85% of screen height, scroll inside
          "max-h-[85vh] sm:max-h-[90vh]",
          "flex flex-col",
          "sm:w-full sm:mx-4",
          maxW
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* Header — fixed, doesn't scroll */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-base font-semibold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}