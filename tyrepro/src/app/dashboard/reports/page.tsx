"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, FileText, Package, RotateCcw, CalendarClock } from "lucide-react";
import DailySalesReport from "@/components/reports/DailySalesReport";
import ChequesReport from "@/components/reports/ChequesReport";
import StockMovementReport from "@/components/reports/StockMovementReport";
import UCReturnsReport from "@/components/reports/UCReturnsReport";
import ShopSalesReport from "@/components/reports/ShopSalesReport";

const TABS = [
  { key: "daily",   label: "Daily Sales", icon: BarChart3     },
  { key: "shop",    label: "Shop-wise",   icon: FileText      },
  { key: "cheques", label: "Cheques",     icon: CalendarClock },
  { key: "stock",   label: "Stock",       icon: Package       },
  { key: "uc",      label: "UC Returns",  icon: RotateCcw     },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("daily");

  return (
    <div className="w-full max-w-full overflow-x-hidden px-3 py-4 md:p-6 md:max-w-3xl md:mx-auto">
      <div className="mb-4 px-1">
        <h1 className="text-lg md:text-xl font-medium text-gray-900">Reports</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-0.5">
          Dilshan Enterprises — business overview
        </p>
      </div>

      {/* Tab bar — horizontal scroll, snap, no visible scrollbar */}
      <div className="mb-4 w-full overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-2 snap-x snap-mandatory w-max">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs md:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 snap-start",
                tab === key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-600"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Report content */}
      <div className="space-y-4 w-full max-w-full overflow-x-hidden">
        {tab === "daily"   && <DailySalesReport />}
        {tab === "shop"    && <ShopSalesReport />}
        {tab === "cheques" && <ChequesReport />}
        {tab === "stock"   && <StockMovementReport />}
        {tab === "uc"      && <UCReturnsReport />}
      </div>
    </div>
  );
}