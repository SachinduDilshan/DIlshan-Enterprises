"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, CalendarClock, Package,
  RotateCcw, Truck, Settings, LogOut, Store, BarChart3,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { SignOutDialog } from "@/components/ui/SignOutDialog";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

/* Sidebar look. Change these values to adjust the background. */

const SIDEBAR_IMAGE = "/ceat-dilshan-banner.png";
const SIDEBAR_COLOR = "#100c5f";
const SIDEBAR_RGB = "16, 12, 95";
// 1 hides the picture. 0.88 keeps a soft picture and clear menu text.
const OVERLAY_STRENGTH = 0.88;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

const SIDEBAR_OVERLAY = `linear-gradient(to bottom,
  rgba(${SIDEBAR_RGB}, ${clamp(OVERLAY_STRENGTH - 0.08)}) 0%,
  rgba(${SIDEBAR_RGB}, ${clamp(OVERLAY_STRENGTH)}) 12%,
  rgba(${SIDEBAR_RGB}, ${clamp(OVERLAY_STRENGTH)}) 70%,
  rgba(${SIDEBAR_RGB}, ${clamp(OVERLAY_STRENGTH - 0.26)}) 100%)`;

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sales_rep", "driver"] },
      { href: "/dashboard/shops", label: "Shops", icon: Store, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/invoices", label: "Invoices", icon: FileText, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/cheques", label: "Cheques", icon: CalendarClock, roles: ["admin", "sales_rep"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Package, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/uc-returns", label: "Returns", icon: RotateCcw, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/dispatch", label: "Dispatch (Coming Soon)", icon: Truck, roles: ["admin", "sales_rep", "driver"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin"] },
    ],
  },
];

export function Sidebar() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString("en-LK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const pathname = usePathname();
  const { appUser } = useAuth();
  const role = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";
  const [showLogout, setShowLogout] = useState(false);

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className="relative isolate flex h-full w-full flex-col"
      style={{ backgroundColor: SIDEBAR_COLOR }}
    >
      {/* Background picture, behind everything and clipped to the sidebar */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SIDEBAR_IMAGE}
          alt=""
          decoding="async"
          className="h-full w-full object-cover"
          style={{ objectPosition: "50% 50%" }}
        />
        <div className="absolute inset-0" style={{ background: SIDEBAR_OVERLAY }} />
      </div>

      {/* Brand */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <Link href="/dashboard" aria-label="Dilshan Enterprises, go to dashboard">
          <Logo variant="white" size={34} />
        </Link>
        {canSeeAlerts && <NotificationBell position="sidebar" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-4 pb-1 pt-4 text-[10px] font-medium uppercase tracking-wider text-white/55">
                {section.label}
              </p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-white/35 text-white"
                        : "text-white/55 hover:bg-white/20 hover:text-white/90"
                    )}>
                    {active && (
                      <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-r bg-indigo-300" />
                    )}
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Live Clock */}
      <div className="border-t border-white/10 px-4 py-3">
        <div className="rounded-lg bg-white/10 px-3 py-2.5 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-wider text-white/55">
            Local Time
          </p>

          <p className="mt-0.5 text-lg font-medium tracking-wide text-white">
            {formattedTime}
          </p>

          <p className="text-[10px] text-white/60">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* User */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/40 text-[11px] font-medium text-white">
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-white">{appUser?.displayName}</p>
            <p className="text-[10px] capitalize text-white/60">{appUser?.role?.replace("_", " ")}</p>
          </div>
          <button
            onClick={() => setShowLogout(true)}
            title="Sign out"
            aria-label="Sign out"
            className="text-white/70 transition-colors hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showLogout && (
        <SignOutDialog
          name={appUser?.displayName}
          email={appUser?.email}
          role={appUser?.role}
          onConfirm={handleSignOut}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </aside>
  );
}