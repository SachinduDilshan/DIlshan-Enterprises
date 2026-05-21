import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Timestamp } from "firebase/firestore";
import { addDays, format } from "date-fns";
import type { PaymentType } from "@/types";

/** Tailwind class merger */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format LKR currency */
export function formatLKR(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format Firestore Timestamp → readable date string */
export function formatDate(ts: Timestamp | undefined, fmt = "dd MMM yyyy"): string {
  if (!ts) return "—";
  return format(ts.toDate(), fmt);
}

/** Days offset for each payment type */
const PAYMENT_DAYS: Record<PaymentType, number> = {
  cash:        0,
  cheque_15d: 15,
  cheque_30d: 30,
  cheque_45d: 45,
  cheque_60d: 60,
};

/** Calculate cheque due date from invoice date */
export function calcDueDate(invoiceDate: Date, paymentType: PaymentType): Date {
  return addDays(invoiceDate, PAYMENT_DAYS[paymentType]);
}

/** Human-friendly payment type label */
export function paymentLabel(pt: PaymentType): string {
  const map: Record<PaymentType, string> = {
    cash:        "Cash",
    cheque_15d:  "Cheque (15 days)",
    cheque_30d:  "Cheque (30 days)",
    cheque_45d:  "Cheque (45 days)",
    cheque_60d:  "Cheque (60 days)",
  };
  return map[pt];
}

/** Generate stock document ID */
export function stockId(warehouseId: string, productId: string): string {
  return `${warehouseId}_${productId}`;
}
