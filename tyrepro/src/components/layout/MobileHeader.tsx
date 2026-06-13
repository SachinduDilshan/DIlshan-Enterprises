"use client";

import { useState } from "react";
import { LogOut, Bell } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function MobileHeader() {
  const { appUser } = useAuth();
  const role         = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfile, setShowProfile]             = useState(false);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <>
      <div className="md:hidden flex items-center justify-between bg-brand-700 px-4 py-3 sticky top-0 z-30">
        <div>
          <p className="text-sm font-medium text-white leading-tight">Dilshan Enterprises</p>
          <p className="text-[11px] text-white/50 leading-tight">Tire Distributors</p>
        </div>

        <div className="flex items-center gap-2">
          {canSeeAlerts && <NotificationBell position="mobile-header" />}

          {/* Profile avatar — tap to open menu */}
          <button
            onClick={() => setShowProfile(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white"
          >
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </button>
        </div>
      </div>

      {/* Profile sheet */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:hidden" onClick={() => setShowProfile(false)}>
          <div className="w-full rounded-t-3xl bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-800">
                {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{appUser?.displayName ?? "User"}</p>
                <p className="text-xs text-gray-500 capitalize">{appUser?.role?.replace("_", " ")}</p>
              </div>
            </div>

            <button
              onClick={() => { setShowProfile(false); setShowLogoutConfirm(true); }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-danger-500 hover:bg-danger-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>

            <button
              onClick={() => setShowProfile(false)}
              className="mt-2 w-full rounded-xl py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <ConfirmDialog
          title="Sign out?"
          description={`You're signed in as ${appUser?.displayName ?? "User"}. You'll need to log in again to access TyrePro.`}
          confirmLabel="Sign out"
          icon={LogOut}
          iconBg="bg-danger-50"
          iconColor="text-danger-500"
          onConfirm={handleSignOut}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </>
  );
}