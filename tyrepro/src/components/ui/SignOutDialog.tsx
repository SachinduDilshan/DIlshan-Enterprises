"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";

interface SignOutDialogProps {
  name?: string;
  email?: string;
  role?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  sales_rep: "Sales rep",
  driver: "Driver",
};

function initials(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function SignOutDialog({ name, email, role, onConfirm, onCancel }: SignOutDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Move focus into the dialog, give it back when closed,
  // and stop the page behind from scrolling while it is open.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    confirmRef.current?.focus();
    return () => {
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
      // On success the page moves to the login screen, so nothing else to do
    } catch {
      setError("Could not sign out. Check your connection and try again.");
      setBusy(false);
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
    const last = confirmRef.current;
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
        className="signout-backdrop absolute inset-0 bg-[#16152F]/60"
        onClick={() => { if (!busy) onCancel(); }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signout-title"
        aria-describedby="signout-desc"
        className="signout-card relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700"
          >
            <LogOut className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 id="signout-title" className="text-lg font-semibold tracking-tight text-gray-900">
              Sign out of TyrePro?
            </h2>
            <p id="signout-desc" className="mt-1 text-sm text-gray-600">
              You will need to enter your email and password again to sign back in.
            </p>
          </div>
        </div>

        {/* Who is signed in */}
        <div className="mt-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700"
          >
            {initials(name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{name || "Signed in"}</p>
            <p className="truncate text-xs text-gray-600">
              {[email, role ? ROLE_LABEL[role] ?? role : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

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
            className="h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:h-10"
          >
            Stay signed in
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10"
          >
            {busy ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Signing out...
              </>
            ) : (
              "Sign out"
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes signoutFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes signoutPop {
          from { opacity: 0; transform: translateY(12px) scale(0.98) }
          to   { opacity: 1; transform: translateY(0) scale(1) }
        }
        .signout-backdrop { animation: signoutFade 0.15s ease-out; }
        .signout-card { animation: signoutPop 0.18s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .signout-backdrop, .signout-card { animation: none; }
        }
      `}</style>
    </div>,
    document.body
  );
}