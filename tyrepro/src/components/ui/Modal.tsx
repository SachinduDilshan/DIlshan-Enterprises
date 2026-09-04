"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const maxW = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
  }[size];

  return (
    <div
      className="
        fixed inset-0
        z-[99999]
        flex items-end justify-center
        bg-black/50
        sm:items-center
        sm:p-4
      "
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "relative flex w-full min-h-0 flex-col overflow-hidden bg-white",
          "rounded-t-3xl sm:rounded-2xl",
          "max-h-[85dvh]",
          "sm:max-h-[90dvh]",
          maxW
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-200" />
        </div>

        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              flex h-9 w-9 shrink-0
              items-center justify-center
              rounded-xl
              border border-gray-200
              bg-white
              transition-colors
              hover:bg-gray-50
              active:bg-gray-100
            "
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            overflow-x-hidden
            overscroll-contain
          "
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div className="px-5 py-4">
            {children}
          </div>
        </div>

        {/* FOOTER */}
        {footer && (
          <div
            className="
              relative z-20
              shrink-0
              border-t border-gray-200
              bg-white
              px-5
              pt-3
              pb-[max(12px,env(safe-area-inset-bottom))]
              shadow-[0_-4px_12px_rgba(0,0,0,0.04)]
            "
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}