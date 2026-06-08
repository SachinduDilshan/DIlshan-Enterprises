"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Package, Truck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function MobileNav() {
  const pathname    = usePathname();
  const { appUser } = useAuth();
  const role        = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";

  const tabs = [
    { href: "/dashboard",            label: "Home",    icon: LayoutDashboard, roles: ["admin","sales_rep","driver"] },
    { href: "/dashboard/invoices",   label: "Invoice", icon: FileText,        roles: ["admin","sales_rep"]          },
    { href: "/dashboard/inventory",  label: "Stock",   icon: Package,         roles: ["admin","sales_rep"]          },
    { href: "/dashboard/dispatch",   label: "Dispatch",icon: Truck,           roles: ["admin","sales_rep","driver"] },
    { href: "/dashboard/reports",    label: "Reports", icon: BarChart3,       roles: ["admin","sales_rep"]          },
  ].filter(t => t.roles.includes(role));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-100 bg-white pb-safe md:hidden">
      <div className="flex items-center">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-brand-600" : "text-gray-400"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        {/* Notification bell on mobile — admin/sales_rep only */}
        {canSeeAlerts && (
          <div className="flex flex-col items-center justify-center px-3 py-2.5">
            <NotificationBell />
          </div>
        )}
      </div>
    </nav>
  );
}
