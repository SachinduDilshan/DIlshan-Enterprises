"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Package, Truck, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function MobileNav() {
  const pathname     = usePathname();
  const { appUser }  = useAuth();
  const role         = appUser?.role ?? "sales_rep";
  const canSeeAlerts = role === "admin" || role === "sales_rep";
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const tabs = [
    { href: "/dashboard",           label: "Home",    icon: LayoutDashboard, roles: ["admin","sales_rep","driver"] },
    { href: "/dashboard/invoices",  label: "Invoice", icon: FileText,        roles: ["admin","sales_rep"]          },
    { href: "/dashboard/inventory", label: "Stock",   icon: Package,         roles: ["admin","sales_rep"]          },
    { href: "/dashboard/dispatch",  label: "Dispatch",icon: Truck,           roles: ["admin","sales_rep","driver"] },
    { href: "/dashboard/reports",   label: "Reports", icon: BarChart3,       roles: ["admin","sales_rep"]          },
  ].filter(t => t.roles.includes(role));

  const nav = (
    <nav
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-gray-100 bg-white pb-safe md:hidden"
      style={{ position: "fixed", bottom: 0, left: 0, right: 0 }}
    >
      <div className="flex items-center">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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

        {canSeeAlerts && (
          <div className="flex flex-1 flex-col items-center gap-1 py-2 relative">
            <NotificationBell position="mobile" />
            <span className="text-[10px] font-medium text-gray-400">Alerts</span>
          </div>
        )}
      </div>
    </nav>
  );

  // Render via portal to escape any ancestor transform/overflow that breaks `fixed`
  if (!mounted) return null;
  return createPortal(nav, document.body);
}