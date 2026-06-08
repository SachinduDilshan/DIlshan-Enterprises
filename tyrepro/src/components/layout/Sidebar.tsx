"use client";

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
import { cn } from "@/lib/utils";

const NAV_ALL = [
  { href: "/dashboard",             label: "Dashboard",  icon: LayoutDashboard, roles: ["admin","sales_rep","driver"] },
  { href: "/dashboard/shops",       label: "Shops",      icon: Store,           roles: ["admin","sales_rep"]          },
  { href: "/dashboard/invoices",    label: "Invoices",   icon: FileText,        roles: ["admin","sales_rep"]          },
  { href: "/dashboard/cheques",     label: "Cheques",    icon: CalendarClock,   roles: ["admin","sales_rep"]          },
  { href: "/dashboard/inventory",   label: "Inventory",  icon: Package,         roles: ["admin","sales_rep"]          },
  { href: "/dashboard/uc-returns",  label: "UC Returns", icon: RotateCcw,       roles: ["admin","sales_rep"]          },
  { href: "/dashboard/dispatch",    label: "Dispatch",   icon: Truck,           roles: ["admin","sales_rep","driver"] },
  { href: "/dashboard/reports",     label: "Reports",    icon: BarChart3,       roles: ["admin","sales_rep"]          },
];

export function Sidebar() {
  const pathname    = usePathname();
  const { appUser } = useAuth();
  const role        = appUser?.role ?? "sales_rep";
  const navItems    = NAV_ALL.filter(item => item.roles.includes(role));
  const canSeeAlerts = role === "admin" || role === "sales_rep";

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-100 bg-white">
      {/* Brand + notification bell */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-gray-100">
        <div>
          <span className="text-sm font-semibold text-gray-900 leading-tight block">Dilshan Enterprises</span>
          <span className="text-xs text-gray-400 leading-tight block">Tire Distributors</span>
        </div>
        {canSeeAlerts && <NotificationBell />}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-800" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}>
              <Icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-brand-600" : "text-gray-400")} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 px-3 py-4 space-y-0.5">
        {role === "admin" && (
          <Link href="/dashboard/settings"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/dashboard/settings")
                ? "bg-brand-50 text-brand-800"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}>
            <Settings className="h-4 w-4 text-gray-400" />
            Settings
          </Link>
        )}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 flex-shrink-0">
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{appUser?.displayName ?? "User"}</p>
            <p className="text-xs text-gray-500 capitalize">{appUser?.role?.replace("_", " ")}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
