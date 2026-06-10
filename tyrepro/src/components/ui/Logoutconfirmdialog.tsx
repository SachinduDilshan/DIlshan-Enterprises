"use client";

import { LogOut, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoutConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  displayName?: string;
}

export function LogoutConfirmDialog({
  open,
  onConfirm,
  onCancel,
  displayName,
}: LogoutConfirmDialogProps) {
  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
    >
      {/* Dimmed overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        className={cn(
          "relative z-10 w-full sm:max-w-sm",
          "bg-white rounded-2xl shadow-xl",
          "p-6",
          // Slide-up on mobile, scale-in on desktop via CSS
          "animate-in fade-in-0 slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95",
          "duration-200"
        )}
      >
        {/* Close (X) button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 mb-4">
          <LogOut className="h-5 w-5 text-red-500" />
        </div>

        {/* Text */}
        <h2
          id="logout-dialog-title"
          className="text-base font-semibold text-gray-900 mb-1"
        >
          Sign out?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {displayName
            ? `You're signed in as ${displayName}. Are you sure you want to sign out?`
            : "Are you sure you want to sign out of your account?"}
        </p>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 active:bg-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}