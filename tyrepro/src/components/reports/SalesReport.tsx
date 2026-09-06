"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatLKR, formatDate, cn } from "@/lib/utils";

import {
  TrendingUp,
  FileText,
  CreditCard,
  Banknote,
  Download,
  FileSpreadsheet,
} from "lucide-react";

import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import type { Invoice } from "@/types";

/*
|--------------------------------------------------------------------------
| Shared Period Selector
|--------------------------------------------------------------------------
| IMPORTANT:
| This imports the fixed PeriodSelector that uses a mobile portal.
| Therefore it will not be clipped by Reports page overflow styles.
*/
import {
  PeriodSelector,
  getDateRange,
} from "@/components/reports/PeriodSelector";


/* =========================================================================
   STAT CARD
=========================================================================== */

function StatCard({
  icon: Icon,
  bg,
  fg,
  label,
  value,
  loading,
}: {
  icon: React.ElementType;
  bg: string;
  fg: string;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card className="flex min-w-0 items-center gap-3">
      <div
        className={cn(
          "flex-shrink-0 rounded-xl p-2.5",
          bg
        )}
      >
        <Icon className={cn("h-5 w-5", fg)} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-gray-500">
          {label}
        </p>

        <p className="truncate text-lg font-semibold text-gray-900">
          {loading ? "—" : value}
        </p>
      </div>
    </Card>
  );
}


/* =========================================================================
   MAIN SALES REPORT
=========================================================================== */

export default function DailySalesReport() {
  const { appUser } = useAuth();

  /* -----------------------------------------------------------------------
     Period state
  ----------------------------------------------------------------------- */

  const [range, setRange] = useState("month");

  const [customFrom, setCustomFrom] = useState("");

  const [customTo, setCustomTo] = useState("");

  /* -----------------------------------------------------------------------
     Invoice state
  ----------------------------------------------------------------------- */

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);

  /* -----------------------------------------------------------------------
     Permissions
  ----------------------------------------------------------------------- */

  const canExport =
    appUser?.role === "admin" ||
    appUser?.role === "sales_rep";


  /* -----------------------------------------------------------------------
     Date range
     
     IMPORTANT:
     getDateRange now comes from the shared PeriodSelector component.
  ----------------------------------------------------------------------- */

  const {
    start,
    end,
    label,
  } = getDateRange(
    range,
    customFrom,
    customTo
  );


  /* -----------------------------------------------------------------------
     Group long periods by month
  ----------------------------------------------------------------------- */

  const showGrouped = [
    "year",
    "lastyear",
    "alltime",
    "quarter",
  ].includes(range);


  /* =========================================================================
     LOAD INVOICES
  =========================================================================== */

  useEffect(() => {
    if (range === "custom" && (!customFrom || !customTo)) {
      setLoading(false);
      setInvoices([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const { start, end } = getDateRange(range, customFrom, customTo);
        const snap = await getDocs(query(
          collection(db, "invoices"),
          where("status", "==", "confirmed"),
          where("invoiceDate", ">=", Timestamp.fromDate(start)),
          where("invoiceDate", "<=", Timestamp.fromDate(end)),
          orderBy("invoiceDate", "desc")
        ));
        if (!cancelled) {
          setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
        }
      } catch (err) {
        console.error("Sales report load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [range, customFrom, customTo]);


  /* =========================================================================
     CALCULATIONS
  =========================================================================== */

  const totalSales = invoices.reduce(
    (sum, invoice) =>
      sum + invoice.totalAmount,
    0
  );

  const cashSales = invoices
    .filter(
      (invoice) =>
        invoice.paymentType === "cash"
    )
    .reduce(
      (sum, invoice) =>
        sum + invoice.totalAmount,
      0
    );

  const chequeSales = invoices
    .filter(
      (invoice) =>
        invoice.paymentType !== "cash"
    )
    .reduce(
      (sum, invoice) =>
        sum + invoice.totalAmount,
      0
    );


  /* =========================================================================
     GROUP BY DATE
  =========================================================================== */

  const byDate: Record<
    string,
    Invoice[]
  > = {};

  invoices.forEach((invoice) => {
    const date = formatDate(
      invoice.invoiceDate,
      "dd MMM yyyy"
    );

    byDate[date] = [
      ...(byDate[date] ?? []),
      invoice,
    ];
  });


  /* =========================================================================
     MONTHLY BREAKDOWN
  =========================================================================== */

  const byMonth: Record<
    string,
    {
      total: number;
      count: number;
    }
  > = {};

  if (showGrouped) {
    invoices.forEach((invoice) => {
      const month =
        invoice.invoiceDate
          .toDate()
          .toLocaleDateString(
            "en-LK",
            {
              month: "long",
              year: "numeric",
            }
          );

      byMonth[month] = byMonth[month]
        ? {
          total:
            byMonth[month].total +
            invoice.totalAmount,

          count:
            byMonth[month].count + 1,
        }
        : {
          total: invoice.totalAmount,
          count: 1,
        };
    });
  }


  /* =========================================================================
     EXCEL EXPORT
  =========================================================================== */

  function handleExcelExport() {
    exportToExcel(
      invoices.map((invoice) => ({
        "Invoice No":
          invoice.invoiceNo,

        Shop:
          invoice.shopName,

        Date:
          formatDate(
            invoice.invoiceDate,
            "dd MMM yyyy"
          ),

        Payment:
          invoice.paymentType === "cash"
            ? "Cash"
            : invoice.paymentType
              .replace(
                "cheque_",
                "Cheque "
              )
              .replace(
                "d",
                " days"
              ),

        "Amount (Rs)":
          invoice.totalAmount,

        Warehouse:
          invoice.warehouseName,
      })),

      `Sales-${label.replace(
        /[\s/–]/g,
        "-"
      )}`,

      "Sales"
    );
  }


  /* =========================================================================
     PDF EXPORT
  =========================================================================== */

  function handlePDFExport() {
    exportToPDF(
      `Sales Report — ${label}`,

      label,

      [
        "Invoice No",
        "Shop",
        "Date",
        "Payment",
        "Amount (Rs)",
        "Warehouse",
      ],

      invoices.map((invoice) => [
        invoice.invoiceNo,

        invoice.shopName,

        formatDate(
          invoice.invoiceDate,
          "dd MMM yyyy"
        ),

        invoice.paymentType === "cash"
          ? "Cash"
          : invoice.paymentType
            .replace(
              "cheque_",
              "Cheque "
            )
            .replace(
              "d",
              " days"
            ),

        `Rs ${invoice.totalAmount.toLocaleString()}`,

        invoice.warehouseName,
      ]),

      [
        {
          label: "Total Sales",
          value: formatLKR(
            totalSales
          ),
        },

        {
          label: "Cash Sales",
          value: formatLKR(
            cashSales
          ),
        },

        {
          label: "Cheque Sales",
          value: formatLKR(
            chequeSales
          ),
        },

        {
          label: "Total Invoices",
          value: String(
            invoices.length
          ),
        },

        {
          label: "Period",
          value: label,
        },
      ]
    );
  }


  /* =========================================================================
     UI
  =========================================================================== */

  return (
    <div className="w-full max-w-full space-y-4">

      {/* =====================================================================
          HEADER
      ======================================================================= */}

      <div
        className="
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-start
          sm:justify-between
        "
      >
        {/* Title */}
        <div className="min-w-0">
          <h2 className="text-base font-medium text-gray-800">
            Sales — {label}
          </h2>

          {!loading && (
            <p className="mt-0.5 text-xs text-gray-400">
              {invoices.length} invoices
            </p>
          )}
        </div>


        {/* ================================================================
            ACTIONS + PERIOD SELECTOR
        ================================================================== */}

        <div
          className="
            flex
            w-full
            flex-wrap
            items-center
            gap-2
            sm:w-auto
          "
        >
          {/* Export buttons */}

          {canExport &&
            !loading &&
            invoices.length > 0 && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={
                    handleExcelExport
                  }
                  className="gap-1.5"
                >
                  <FileSpreadsheet
                    className="
                      h-4 w-4
                      text-green-600
                    "
                  />

                  Excel
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={
                    handlePDFExport
                  }
                  className="gap-1.5"
                >
                  <Download
                    className="
                      h-4 w-4
                      text-red-500
                    "
                  />

                  PDF
                </Button>
              </>
            )}


          {/* ==============================================================
              SHARED PERIOD SELECTOR
              
              This is now the SAME selector used by the Reports section.
          =============================================================== */}

          <PeriodSelector
            value={range}
            onChange={setRange}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={
              setCustomFrom
            }
            onCustomToChange={
              setCustomTo
            }
          />
        </div>
      </div>


      {/* =====================================================================
          STAT CARDS
      ======================================================================= */}

      <div
        className="
          grid
          w-full
          grid-cols-2
          gap-3
        "
      >
        <StatCard
          icon={TrendingUp}
          bg="bg-brand-50"
          fg="text-brand-600"
          label="Total sales"
          value={formatLKR(totalSales)}
          loading={loading}
        />

        <StatCard
          icon={FileText}
          bg="bg-gray-100"
          fg="text-gray-600"
          label="Invoices"
          value={String(
            invoices.length
          )}
          loading={loading}
        />

        <StatCard
          icon={Banknote}
          bg="bg-green-50"
          fg="text-green-600"
          label="Cash sales"
          value={formatLKR(cashSales)}
          loading={loading}
        />

        <StatCard
          icon={CreditCard}
          bg="bg-amber-50"
          fg="text-amber-600"
          label="Cheque sales"
          value={formatLKR(
            chequeSales
          )}
          loading={loading}
        />
      </div>


      {/* =====================================================================
          LOADING
      ======================================================================= */}

      {loading && (
        <div className="flex justify-center py-8">
          <div
            className="
              h-7
              w-7
              animate-spin
              rounded-full
              border-4
              border-brand-600
              border-t-transparent
            "
          />
        </div>
      )}


      {/* =====================================================================
          EMPTY STATE
      ======================================================================= */}

      {!loading &&
        invoices.length === 0 && (
          <Card
            className="
              py-10
              text-center
              text-sm
              text-gray-400
            "
          >
            {range === "custom" &&
              (!customFrom ||
                !customTo)
              ? "Select a date range above to view sales"
              : "No sales in this period"}
          </Card>
        )}


      {/* =====================================================================
          MONTHLY BREAKDOWN
      ======================================================================= */}

      {!loading &&
        showGrouped &&
        Object.keys(byMonth).length >
        0 && (
          <Card padding={false}>

            <div
              className="
                rounded-t-2xl
                border-b
                border-gray-50
                bg-gray-50
                px-4
                py-3
              "
            >
              <p className="text-sm font-medium text-gray-700">
                Monthly breakdown
              </p>
            </div>


            {Object.entries(
              byMonth
            ).map(
              (
                [month, data],
                index,
                array
              ) => (
                <div
                  key={month}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    index <
                    array.length - 1 &&
                    "border-b border-gray-50"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {month}
                    </p>

                    <p className="text-xs text-gray-400">
                      {data.count} invoices
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-medium text-gray-900">
                    {formatLKR(
                      data.total
                    )}
                  </p>
                </div>
              )
            )}


            {/* Total */}

            <div
              className="
                flex
                items-center
                justify-between
                rounded-b-2xl
                border-t
                border-brand-100
                bg-brand-50
                px-4
                py-3
              "
            >
              <p className="text-sm font-semibold text-brand-800">
                Total
              </p>

              <p className="text-sm font-semibold text-brand-900">
                {formatLKR(
                  totalSales
                )}
              </p>
            </div>
          </Card>
        )}


      {/* =====================================================================
          DAILY BREAKDOWN
      ======================================================================= */}

      {!loading &&
        !showGrouped &&
        Object.entries(byDate).map(
          ([date, invs]) => (
            <Card
              key={date}
              padding={false}
            >

              {/* Date header */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  rounded-t-2xl
                  border-b
                  border-gray-50
                  bg-gray-50
                  px-4
                  py-3
                "
              >
                <span className="text-sm font-medium text-gray-700">
                  {date}
                </span>

                <span className="text-right text-sm font-medium text-gray-900">
                  {formatLKR(
                    invs.reduce(
                      (sum, invoice) =>
                        sum +
                        invoice.totalAmount,
                      0
                    )
                  )}{" "}
                  · {invs.length} invoices
                </span>
              </div>


              {/* Invoice rows */}

              {invs.map(
                (invoice, index) => (
                  <div
                    key={invoice.id}
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      index <
                      invs.length - 1 &&
                      "border-b border-gray-50"
                    )}
                  >

                    {/* Invoice information */}

                    <div className="min-w-0 flex-1 pr-3">

                      <p className="truncate text-sm font-medium text-gray-900">
                        {invoice.shopName}
                      </p>

                      <p className="text-xs text-gray-400">
                        {invoice.invoiceNo} ·{" "}
                        {invoice.paymentType ===
                          "cash"
                          ? "Cash"
                          : invoice.paymentType
                            .replace(
                              "cheque_",
                              "Cheque "
                            )
                            .replace(
                              "d",
                              " days"
                            )}
                      </p>
                    </div>


                    {/* Amount */}

                    <span className="shrink-0 text-sm font-medium text-gray-900">
                      {formatLKR(
                        invoice.totalAmount
                      )}
                    </span>
                  </div>
                )
              )}
            </Card>
          )
        )}
    </div>
  );
}