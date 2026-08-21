"use client";

import { useEffect, useRef, useState } from "react";
import {
  LogOut,
  Bell,
  ShieldCheck,
  X,
  UserRound,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function MobileHeader() {
  const { appUser } = useAuth();

  const role = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";

  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = appUser?.displayName ?? "User";

  const initials =
    appUser?.displayName
      ?.trim()
      .split(/\s+/)
      .map((name) => name[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  const formattedRole = role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  /*
   * Close profile menu when clicking outside it.
   */
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setShowProfile(false);
      }
    }

    if (showProfile) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showProfile]);

  /*
   * Prevent background scrolling while logout confirmation is open.
   */
  useEffect(() => {
    if (showLogoutConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [showLogoutConfirm]);

  async function handleSignOut() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("Sign out failed:", error);
      setLoggingOut(false);
    }
  }

  function handleProfileClick() {
    setShowProfile((previous) => !previous);
  }

  function handleLogoutClick() {
    setShowProfile(false);

    /*
     * Small delay makes the profile menu close first,
     * then opens the confirmation dialog cleanly.
     */
    requestAnimationFrame(() => {
      setShowLogoutConfirm(true);
    });
  }

  function closeLogoutConfirm() {
    if (loggingOut) return;
    setShowLogoutConfirm(false);
  }

  return (
    <>
      {/* =========================================================
          MOBILE HEADER
      ========================================================= */}

      <header className="sticky top-0 z-40 flex h-[56px] items-center justify-between bg-brand-700 px-4 md:hidden">

        {/* Brand */}

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-white">
            Dilshan Enterprises
          </p>

          <p className="text-[10px] leading-tight text-white/50">
            Tire Distributors
          </p>
        </div>


        {/* Header actions */}

        <div
          ref={profileRef}
          className="relative flex items-center gap-2"
        >

          {canSeeAlerts && (
            <NotificationBell position="mobile-header" />
          )}


          {/* Profile avatar */}

          <button
            type="button"
            onClick={handleProfileClick}
            aria-label="Sign Out"
            aria-expanded={showProfile}
            className={`
              flex h-9 w-9 items-center justify-center
              rounded-full
              text-xs font-bold text-white
              shadow-sm
              ring-1 ring-white/10
              transition-all duration-150
              active:scale-95
              ${
                showProfile
                  ? "bg-white/25 ring-white/30"
                  : "bg-brand-500"
              }
            `}
          >
            {initials}
          </button>


          {/* =====================================================
              PROFILE POPOVER
          ===================================================== */}

          {showProfile && (
            <div
              className="
                absolute
                right-0
                top-[46px]
                z-[70]
                w-[245px]
                overflow-hidden
                rounded-2xl
                border border-gray-200
                bg-white
                shadow-[0_12px_35px_rgba(0,0,0,0.16)]
                animate-in
                fade-in
                zoom-in-95
                slide-in-from-top-1
                duration-150
              "
            >

              {/* User information */}

              <div className="border-b border-gray-100 p-3.5">

                <div className="flex items-center gap-3">

                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">
                    {initials}
                  </div>

                  <div className="min-w-0">

                    <p className="truncate text-sm font-semibold text-gray-900">
                      {displayName}
                    </p>

                    <div className="mt-0.5 flex items-center gap-1">

                      <ShieldCheck className="h-3 w-3 text-brand-500" />

                      <p className="text-[11px] capitalize text-gray-500">
                        {formattedRole}
                      </p>

                    </div>

                  </div>

                </div>

              </div>


              {/* Profile option */}

              <div className="p-1.5">
                {/* Sign out */}

                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="
                    flex w-full items-center gap-3
                    rounded-xl
                    px-3 py-2.5
                    text-left
                    text-sm
                    font-medium
                    text-red-600
                    transition-colors
                    hover:bg-red-50
                  "
                >

                  <LogOut className="h-4 w-4" />

                  <span className="flex-1">
                    Sign out
                  </span>

                </button>

              </div>

            </div>
          )}

        </div>

      </header>


      {/* =========================================================
          LOGOUT CONFIRMATION
          Completely independent of mobile navigation.
      ========================================================= */}

      {showLogoutConfirm && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            items-center
            justify-center
            bg-black/45
            px-5
            backdrop-blur-[2px]
            md:hidden
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
        >

          {/* Confirmation card */}

          <div
            className="
              w-full
              max-w-[340px]
              overflow-hidden
              rounded-2xl
              bg-white
              shadow-[0_20px_60px_rgba(0,0,0,0.22)]
              animate-in
              fade-in
              zoom-in-95
              duration-150
            "
          >

            {/* Top */}

            <div className="relative px-5 pb-4 pt-5">

              {/* Close */}

              <button
                type="button"
                onClick={closeLogoutConfirm}
                disabled={loggingOut}
                className="
                  absolute
                  right-4
                  top-4
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-full
                  text-gray-400
                  transition-colors
                  hover:bg-gray-100
                  hover:text-gray-700
                  disabled:opacity-50
                "
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>


              {/* Icon */}

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">

                <LogOut className="h-5 w-5 text-red-600" />

              </div>


              {/* Title */}

              <h2
                id="logout-title"
                className="mt-4 text-base font-semibold text-gray-900"
              >
                Sign out?
              </h2>


              {/* Description */}

              <p className="mt-1.5 pr-4 text-sm leading-5 text-gray-500">
                Are you sure you want to sign out of your account?
              </p>

            </div>


            {/* Actions */}

            <div className="flex gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4">

              <button
                type="button"
                onClick={closeLogoutConfirm}
                disabled={loggingOut}
                className="
                  h-11
                  flex-1
                  rounded-xl
                  border
                  border-gray-200
                  bg-white
                  text-sm
                  font-semibold
                  text-gray-700
                  transition-colors
                  hover:bg-gray-50
                  disabled:opacity-50
                "
              >
                Cancel
              </button>


              <button
                type="button"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="
                  h-11
                  flex-1
                  rounded-xl
                  bg-red-600
                  text-sm
                  font-semibold
                  text-white
                  shadow-sm
                  transition-all
                  hover:bg-red-700
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {loggingOut ? (
                  <span className="flex items-center justify-center gap-2">

                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />

                    Signing out...

                  </span>
                ) : (
                  "Sign out"
                )}
              </button>

            </div>

          </div>

        </div>
      )}
    </>
  );
}