"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
  confirmLabel?: string;
}

export function DeleteConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Delete",
}: DeleteConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(true);

  // The first line of the description is the record's name. The rest is detail.
  const lines = description.split("\n").map(l => l.trim()).filter(Boolean);
  const headline = lines[0];
  const details = lines.slice(1);

  useEffect(() => {
    mounted.current = true;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Start on Cancel so a stray Enter key press cannot delete anything
    cancelRef.current?.focus();
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      console.error("Delete failed:", err);
      if (mounted.current) setError("Could not delete this record. Please try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && !busy) {
      e.stopPropagation();
      onCancel();
      return;
    }
    if (e.key !== "Tab") return;

    // Keep Tab inside the dialog
    const first = cancelRef.current;
    const last = deleteRef.current;
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100000] flex items-end justify-center p-4 sm:items-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="delete-backdrop absolute inset-0 bg-[#16152F]/60"
        onClick={() => { if (!busy) onCancel(); }}
      />

      {/* Dialog */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-desc"
        className="delete-card relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
          >
            <Trash2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="delete-title" className="text-lg font-semibold tracking-tight text-gray-900">
              {title}
            </h2>
            <p id="delete-desc" className="mt-1 text-sm text-gray-600">
              This will permanently remove the record below. It cannot be undone.
            </p>
          </div>
        </div>

        {/* The record being deleted */}
        {headline && (
          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="break-words text-sm font-medium text-gray-900">{headline}</p>
            {details.map((line, i) => (
              <p key={i} className="mt-0.5 break-words text-xs text-gray-600">
                {line}
              </p>
            ))}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
          >
            Cancel
          </button>
          <button
            ref={deleteRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10"
          >
            {busy ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Deleting...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes deleteFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes deletePop {
          from { opacity: 0; transform: translateY(12px) scale(0.98) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        .delete-backdrop { animation: deleteFade 0.15s ease-out; }
        .delete-card { animation: deletePop 0.18s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .delete-backdrop, .delete-card { animation: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}