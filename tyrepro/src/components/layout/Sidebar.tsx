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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";

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
      { href: "/dashboard/uc-returns", label: "UC Returns", icon: RotateCcw, roles: ["admin", "sales_rep"] },
      { href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, roles: ["admin", "sales_rep", "driver"] },
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
    <aside className="flex h-full w-full flex-col" style={{ background: "#2D2B55" }}>
      {/* Brand */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-white/10">
        <div>
          <p className="text-sm font-medium text-white leading-tight">Dilshan Enterprises</p>
          <p className="text-[11px] text-white/40 leading-tight">Tire Distributors</p>
        </div>
        {canSeeAlerts && <NotificationBell position="sidebar" />}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-4 pt-4 pb-1 text-[10px] font-medium uppercase tracking-wider text-white/30">
                {section.label}
              </p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors relative",
                      active
                        ? "text-white bg-white/10"
                        : "text-white/55 hover:text-white/80 hover:bg-white/5"
                    )}>
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 bg-indigo-300 rounded-r" />
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
        <div className="rounded-lg bg-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-white/30">
            Local Time
          </p>

          <p className="mt-0.5 text-lg font-medium tracking-wide text-white">
            {formattedTime}
          </p>

          <p className="text-[10px] text-white/40">
            {formattedDate}
          </p>
        </div>
      </div>

      {/* User */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/40 text-[11px] font-medium text-white flex-shrink-0">
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-white truncate">{appUser?.displayName}</p>
            <p className="text-[10px] text-white/40 capitalize">{appUser?.role?.replace("_", " ")}</p>
          </div>
          <button
            onClick={() => setShowLogout(true)}
            title="Sign out"
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {showLogout && (
        <ConfirmDialog
          title="Sign Out?"
          description={`You are signed in as ${appUser?.displayName}. You will need to log in again to access TyrePro.`}
          confirmLabel="Sign out"
          icon={LogOut}
          iconBg="bg-red-50"
          iconColor="text-red-600"
          confirmClassName="bg-red-800 hover:bg-red-900"
          onConfirm={handleSignOut}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </aside>
  );
}