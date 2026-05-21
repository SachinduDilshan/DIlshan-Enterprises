"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, CalendarClock, Package,
  RotateCcw, Truck, Settings, LogOut, Store,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",             label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/shops",       label: "Shops",      icon: Store           },
  { href: "/dashboard/invoices",    label: "Invoices",   icon: FileText        },
  { href: "/dashboard/cheques",     label: "Cheques",    icon: CalendarClock   },
  { href: "/dashboard/inventory",   label: "Inventory",  icon: Package         },
  { href: "/dashboard/uc-returns",  label: "UC Returns", icon: RotateCcw       },
  { href: "/dashboard/dispatch",    label: "Dispatch",   icon: Truck           },
  { href: "/dashboard/reports",     label: "Reports",    icon: FileText        },
];

export function Sidebar() {
  const pathname    = usePathname();
  const { appUser } = useAuth();

  async function handleSignOut() {
    await signOut(auth);
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-100 bg-white">
      {/* Brand */}
      <div className="flex h-16 flex-col justify-center px-5 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900 leading-tight">Dilshan Enterprises</span>
        <span className="text-xs text-gray-400 leading-tight">Tire Distributors</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-brand-50 text-brand-800" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-gray-400")} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 px-3 py-4 space-y-0.5">
        <Link href="/dashboard/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
          <Settings className="h-4 w-4 text-gray-400" />
          Settings
        </Link>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 flex-shrink-0">
            {appUser?.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{appUser?.displayName ?? "User"}</p>
            <p className="text-xs text-gray-500 capitalize">{appUser?.role?.replace("_", " ")}</p>
          </div>
          <button onClick={handleSignOut} title="Sign out" className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
