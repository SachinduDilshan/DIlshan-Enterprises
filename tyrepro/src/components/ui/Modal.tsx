"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  title:      string;
  subtitle?:  string;
  onClose:    () => void;
  children:   React.ReactNode;
  size?:      "sm" | "md" | "lg";
}

export function Modal({ title, subtitle, onClose, children, size = "md" }: ModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const maxW = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
  }[size];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full bg-white",
          "rounded-t-3xl sm:rounded-2xl",
          "max-h-[92vh] overflow-y-auto overflow-x-hidden",
          "sm:w-full",
          maxW
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-base font-medium text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}