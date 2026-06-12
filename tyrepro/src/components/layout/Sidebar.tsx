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

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard",          label: "Dashboard", icon: LayoutDashboard, roles: ["admin","sales_rep","driver"] },
      { href: "/dashboard/shops",    label: "Shops",     icon: Store,           roles: ["admin","sales_rep"]          },
      { href: "/dashboard/invoices", label: "Invoices",  icon: FileText,        roles: ["admin","sales_rep"]          },
      { href: "/dashboard/cheques",  label: "Cheques",   icon: CalendarClock,   roles: ["admin","sales_rep"]          },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/inventory",  label: "Inventory",  icon: Package,     roles: ["admin","sales_rep"]          },
      { href: "/dashboard/uc-returns", label: "UC Returns", icon: RotateCcw,   roles: ["admin","sales_rep"]          },
      { href: "/dashboard/dispatch",   label: "Dispatch",   icon: Truck,       roles: ["admin","sales_rep","driver"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/reports",  label: "Reports",  icon: BarChart3, roles: ["admin","sales_rep"] },
      { href: "/dashboard/settings", label: "Settings", icon: Settings,  roles: ["admin"]             },
    ],
  },
];

export function Sidebar() {
  const pathname     = usePathname();
  const { appUser }  = useAuth();
  const role         = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-full w-full flex-col bg-brand-700">
      {/* Brand + bell */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
        <div>
          <span className="text-sm font-medium text-white leading-tight block">
            Dilshan Enterprises
          </span>
          <span className="text-xs text-white/50 leading-tight block">
            Tire Distributors
          </span>
        </div>
        {canSeeAlerts && <NotificationBell position="sidebar" />}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(item => item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="px-4 pt-4 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/35">
                {section.label}
              </p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href}
                    className={cn(
                      "flex items-center gap-3 mx-2 my-0.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/65 hover:bg-white/8 hover:text-white"
                    )}>
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User row */}
      <div className="border-t border-white/10 p-2">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/8 transition-colors">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white flex-shrink-0">
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {appUser?.displayName ?? "User"}
            </p>
            <p className="text-[10px] text-white/45 capitalize">
              {appUser?.role?.replace("_", " ")}
            </p>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="text-white/40 hover:text-white transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}