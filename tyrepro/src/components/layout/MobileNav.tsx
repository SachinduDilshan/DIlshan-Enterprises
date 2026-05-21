"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, CalendarClock, Package, Store, BookA } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard",           label: "Home",    icon: LayoutDashboard },
  { href: "/dashboard/shops",     label: "Shops",   icon: Store           },
  { href: "/dashboard/invoices",  label: "Invoice", icon: FileText        },
  { href: "/dashboard/cheques",   label: "Cheques", icon: CalendarClock   },
  { href: "/dashboard/inventory", label: "Stock",   icon: Package         },
  { href: "/dashboard/reports",   label: "Reports", icon: BookA        },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-100 bg-white pb-safe md:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={cn("flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors", active ? "text-brand-600" : "text-gray-400")}>
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
