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
  { key: "daily",   label: "Daily Sales",    icon: BarChart3      },
  { key: "shop",    label: "Shop-wise",      icon: FileText       },
  { key: "cheques", label: "Cheques",        icon: CalendarClock  },
  { key: "stock",   label: "Stock",          icon: Package        },
  { key: "uc",      label: "UC Returns",     icon: RotateCcw      },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("daily");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-medium text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Dilshan Enterprises — business overview</p>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div className="mb-5 flex gap-1 overflow-x-auto pb-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0",
              tab === key
                ? "bg-brand-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-700"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Report content */}
      {tab === "daily"   && <DailySalesReport />}
      {tab === "shop"    && <ShopSalesReport />}
      {tab === "cheques" && <ChequesReport />}
      {tab === "stock"   && <StockMovementReport />}
      {tab === "uc"      && <UCReturnsReport />}
    </div>
  );
}