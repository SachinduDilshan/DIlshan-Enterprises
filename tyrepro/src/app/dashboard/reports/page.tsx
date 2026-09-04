"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileText,
  Package,
  RotateCcw,
  CalendarClock,
} from "lucide-react";

import ChequesReport from "@/components/reports/ChequesReport";
import StockMovementReport from "@/components/reports/StockMovementReport";
import UCReturnsReport from "@/components/reports/UCReturnsReport";
import ShopSalesReport from "@/components/reports/ShopSalesReport";
import SalesReport from "@/components/reports/SalesReport";

const TABS = [
  {
    key: "daily",
    label: "Sales Report",
    icon: BarChart3,
  },
  {
    key: "shop",
    label: "Shop-wise",
    icon: FileText,
  },
  {
    key: "cheques",
    label: "Cheques",
    icon: CalendarClock,
  },
  {
    key: "stock",
    label: "Stock",
    icon: Package,
  },
  {
    key: "uc",
    label: "UC Returns",
    icon: RotateCcw,
  },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>("daily");

  return (
    <div
      className="
        w-full
        max-w-full
        px-3
        py-4
        md:mx-auto
        md:max-w-3xl
        md:p-6
      "
    >
      {/* =====================================================
          PAGE HEADER
      ===================================================== */}
      <div className="mb-4 px-1">
        <h1 className="text-lg font-medium text-gray-900 md:text-xl">
          Reports
        </h1>

        <p className="mt-0.5 text-xs text-gray-500 md:text-sm">
          Dilshan Enterprises — business overview
        </p>
      </div>

      {/* =====================================================
          REPORT TABS
      ===================================================== */}
      <div className="mb-4 w-full overflow-x-auto scrollbar-none">
        <div
          className="
            flex
            w-max
            snap-x
            snap-mandatory
            gap-2
            pb-2
          "
        >
          {TABS.map(
            ({ key, label, icon: Icon }) => {
              const active = tab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex shrink-0 snap-start items-center gap-1.5",
                    "whitespace-nowrap",
                    "rounded-xl",
                    "px-3.5 py-2",
                    "text-xs font-medium md:text-sm",
                    "transition-colors",
                    "active:scale-[0.98]",
                    active
                      ? "bg-brand-800 text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />

                  {label}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* =====================================================
          REPORT CONTENT
      ===================================================== */}
      <div className="w-full max-w-full">
        {tab === "daily" && <SalesReport />}

        {tab === "shop" && <ShopSalesReport />}

        {tab === "cheques" && <ChequesReport />}

        {tab === "stock" && <StockMovementReport />}

        {tab === "uc" && <UCReturnsReport />}
      </div>
    </div>
  );
}