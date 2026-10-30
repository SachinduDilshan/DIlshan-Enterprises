"use client";

import { useState } from "react";
import { BarChart3, CreditCard, Package, RotateCcw, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import SalesReport from "@/components/reports/SalesReport";
import ShopSalesReport from "@/components/reports/ShopSalesReport";
import PaymentsReport from "@/components/reports/PaymentsReport";
import StockMovementReport from "@/components/reports/StockMovementReport";
import UCReturnsReport from "@/components/reports/UCReturnsReport";

type TabKey = "sales" | "shops" | "payments" | "stock" | "uc";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "sales",    label: "Sales",      icon: BarChart3  },
  { key: "shops",    label: "By shop",    icon: Store      },
  { key: "payments", label: "Payments",   icon: CreditCard },
  { key: "stock",    label: "Stock",      icon: Package    },
  { key: "uc",       label: "UC returns", icon: RotateCcw  },
];

export default function ReportsPage() {
  const { appUser } = useAuth();
  const [tab, setTab] = useState<TabKey>("sales");

  if (String(appUser?.role) === "driver") {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 text-sm text-gray-600">
        Reports are not available for your role.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Reports"
        description="Sales, payments, stock and returns for Dilshan Enterprises"
      />

      {/* Section tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div
          role="tablist"
          aria-label="Report sections"
          className="scrollbar-none -mb-px -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0"
        >
          {TABS.map(t => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-brand-600 text-gray-900"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "sales"    && <SalesReport />}
        {tab === "shops"    && <ShopSalesReport />}
        {tab === "payments" && <PaymentsReport />}
        {tab === "stock"    && <StockMovementReport />}
        {tab === "uc"       && <UCReturnsReport />}
      </div>
    </div>
  );
}