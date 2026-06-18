"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Package, Truck, BarChart3,
  CalendarClock, RotateCcw, Settings, Grid2x2, X, Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export function MobileNav() {
  const pathname = usePathname();
  const { appUser } = useAuth();
  const role = appUser?.role ?? "sales_rep";
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // Primary 5 tabs (no Alerts — bell already lives in top header)
  const tabs = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard, roles: ["admin", "sales_rep", "driver"] },
    { href: "/dashboard/invoices", label: "Invoice", icon: FileText, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/inventory", label: "Inventory", icon: Package, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/dispatch", label: "Dispatch", icon: Truck, roles: ["admin", "sales_rep", "driver"] },
  ].filter(t => t.roles.includes(role));

  // "More" menu items
  const moreItems = [
    { href: "/dashboard/shops", label: "Shops", icon: Store, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/cheques", label: "Cheques", icon: CalendarClock, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/uc-returns", label: "UC Returns", icon: RotateCcw, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, roles: ["admin", "sales_rep"] },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["admin"] },
  ].filter(t => t.roles.includes(role));

  const hasMore = moreItems.length > 0;
  const moreActive = moreItems.some(m =>
    m.href === "/dashboard"
      ? pathname === m.href
      : pathname === m.href || pathname.startsWith(m.href + "/")
  );

  const nav = (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[100] border-t border-gray-100 bg-white pb-safe md:hidden"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
      >
        <div className="flex items-center">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = href === "/dashboard"
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand-600" : "text-gray-400"
                )}>
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}

          {hasMore && (
            <button
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                moreActive ? "text-brand-600" : "text-gray-400"
              )}
            >
              <Grid2x2 className="h-5 w-5" />
              More
            </button>
          )}
        </div>
      </nav>

      {/* "More" bottom sheet */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-4 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gray-900">More</p>
              <button onClick={() => setMoreOpen(false)} className="text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = href === "/dashboard"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border py-4 text-xs font-medium transition-colors",
                      active
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-gray-100 bg-gray-50 text-gray-600"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (!mounted) return null;
  return createPortal(nav, document.body);
}