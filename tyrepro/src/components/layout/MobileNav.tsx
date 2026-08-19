"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Package, Truck,
  BarChart3, CalendarClock, RotateCcw, Settings,
  Grid2x2, X, Store,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function MobileNav() {
  const pathname    = usePathname();
  const { appUser } = useAuth();
  const role        = appUser?.role ?? "sales_rep";
  const [mounted, setMounted]     = useState(false);
  const [isMobile, setIsMobile]   = useState(false);
  const [moreOpen, setMoreOpen]   = useState(false);

  useEffect(() => {
    setMounted(true);

    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const tabs = [
    { href: "/dashboard",           label: "Home",    icon: LayoutDashboard, roles: ["admin","sales_rep","driver"] },
    { href: "/dashboard/invoices",  label: "Invoice", icon: FileText,        roles: ["admin","sales_rep"]          },
    { href: "/dashboard/inventory", label: "Stock",   icon: Package,         roles: ["admin","sales_rep"]          },
    { href: "/dashboard/dispatch",  label: "Dispatch",icon: Truck,           roles: ["admin","sales_rep","driver"] },
  ].filter(t => t.roles.includes(role));

  const moreItems = [
    { href: "/dashboard/shops",      label: "Shops",      icon: Store,         roles: ["admin","sales_rep"] },
    { href: "/dashboard/cheques",    label: "Cheques",    icon: CalendarClock, roles: ["admin","sales_rep"] },
    { href: "/dashboard/uc-returns", label: "UC Returns", icon: RotateCcw,     roles: ["admin","sales_rep"] },
    { href: "/dashboard/reports",    label: "Reports",    icon: BarChart3,     roles: ["admin","sales_rep"] },
    { href: "/dashboard/settings",   label: "Settings",   icon: Settings,      roles: ["admin"]             },
  ].filter(t => t.roles.includes(role));

  const hasMore    = moreItems.length > 0;
  const moreActive = moreItems.some(m =>
    m.href === "/dashboard"
      ? pathname === m.href
      : pathname === m.href || pathname.startsWith(m.href + "/")
  );

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/");
  }

  if (!mounted || !isMobile) return null;

  return createPortal(
    <>
      {/* Bottom nav bar */}
      <div style={{
        position:   "fixed",
        bottom:     0,
        left:       0,
        right:      0,
        zIndex:     9999,
        background: "white",
        borderTop:  "0.5px solid #e5e7eb",
        display:    "flex",
        alignItems: "stretch",
      }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} style={{ flex: 1, textDecoration: "none" }}
              onClick={() => setMoreOpen(false)}>
              <div style={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                justifyContent: "center",
                gap:            "3px",
                padding:        "8px 0 10px",
                color:          active ? "#3730A3" : "#9ca3af",
                fontSize:       "10px",
                fontWeight:     500,
              }}>
                <Icon style={{ width: 20, height: 20 }} />
                {label}
              </div>
            </Link>
          );
        })}

        {hasMore && (
          <button
            onClick={() => setMoreOpen(v => !v)}
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              gap:            "3px",
              padding:        "8px 0 10px",
              color:          moreActive || moreOpen ? "#3730A3" : "#9ca3af",
              fontSize:       "10px",
              fontWeight:     500,
              border:         "none",
              background:     "transparent",
              cursor:         "pointer",
            }}
          >
            <Grid2x2 style={{ width: 20, height: 20 }} />
            More
          </button>
        )}
      </div>

      {/* More bottom sheet */}
      {moreOpen && (
        <div
          style={{
            position:   "fixed",
            inset:      0,
            zIndex:     9998,
            background: "rgba(0,0,0,0.4)",
            display:    "flex",
            alignItems: "flex-end",
          }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            style={{
              width:        "100%",
              background:   "white",
              borderRadius: "24px 24px 0 0",
              padding:      "16px 16px 90px",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>More</p>
              <button onClick={() => setMoreOpen(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {moreItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}
                    style={{ textDecoration: "none" }}
                    onClick={() => setMoreOpen(false)}>
                    <div style={{
                      display:        "flex",
                      flexDirection:  "column",
                      alignItems:     "center",
                      gap:            "8px",
                      padding:        "14px 8px",
                      borderRadius:   12,
                      border:         active ? "1px solid #818cf8" : "0.5px solid #f3f4f6",
                      background:     active ? "#eef2ff" : "#f9fafb",
                      fontSize:       12,
                      fontWeight:     500,
                      color:          active ? "#3730A3" : "#4b5563",
                    }}>
                      <Icon style={{ width: 20, height: 20 }} />
                      {label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}