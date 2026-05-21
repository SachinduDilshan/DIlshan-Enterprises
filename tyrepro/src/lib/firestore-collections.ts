import { collection, CollectionReference } from "firebase/firestore";
import { db } from "./firebase";
import type {
  AppUser, Warehouse, Product, Stock, Shop,
  Invoice, InvoiceItem, Cheque, UCReturn,
  StockTransfer, Dispatch, DispatchStop,
} from "@/types";

function col<T>(path: string) {
  return collection(db, path) as CollectionReference<T>;
}

export const usersCol      = col<AppUser>("users");
export const warehousesCol = col<Warehouse>("warehouses");
export const productsCol   = col<Product>("products");
export const stockCol      = col<Stock>("stock");
export const shopsCol      = col<Shop>("shops");
export const invoicesCol   = col<Invoice>("invoices");
export const chequesCol    = col<Cheque>("cheques");
export const ucReturnsCol  = col<UCReturn>("ucReturns");
export const transfersCol  = col<StockTransfer>("stockTransfers");
export const dispatchesCol = col<Dispatch>("dispatches");

export function invoiceItemsCol(invoiceId: string) {
  return collection(db, "invoices", invoiceId, "items") as CollectionReference<InvoiceItem>;
}

export function dispatchStopsCol(dispatchId: string) {
  return collection(db, "dispatches", dispatchId, "stops") as CollectionReference<DispatchStop>;
}
