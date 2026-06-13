"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { MobileHeader } from "@/components/layout/MobileHeader";

const DRIVER_ALLOWED = ["/dashboard", "/dashboard/dispatch"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!firebaseUser) { router.replace("/login"); return; }
      if (appUser && !appUser.active) { router.replace("/login"); return; }
      if (appUser?.role === "driver") {
        const allowed = DRIVER_ALLOWED.some(p => pathname === p || pathname.startsWith(p + "/"));
        if (!allowed) router.replace("/dashboard/dispatch");
      }
      setChecked(true);
    }, 150);
    return () => clearTimeout(t);
  }, [firebaseUser, appUser, loading, pathname, router]);

  if (loading || !checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!firebaseUser || !appUser) return null;

  return (
    <>
      <div className="flex min-h-screen bg-gray-50 w-full max-w-full overflow-x-hidden">
        <div className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-30">
          <Sidebar />
        </div>
        <main className="flex-1 w-full max-w-full min-w-0 overflow-x-hidden md:ml-60 pb-20 md:pb-0">
          <MobileHeader />
          {children}
        </main>
      </div>
      <MobileNav />
    </>
  );
}