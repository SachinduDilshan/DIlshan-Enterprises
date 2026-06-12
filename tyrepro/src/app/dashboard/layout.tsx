"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

const DRIVER_ALLOWED = ["/dashboard", "/dashboard/dispatch"];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, appUser, loading } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace("/login"); return; }
    if (appUser && !appUser.active) { router.replace("/login"); return; }
    if (appUser?.role === "driver") {
      const allowed = DRIVER_ALLOWED.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) router.replace("/dashboard/dispatch");
    }
  }, [firebaseUser, appUser, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!firebaseUser || !appUser) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0">
        <Sidebar />
      </div>
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}