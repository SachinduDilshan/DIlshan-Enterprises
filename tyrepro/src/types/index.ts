import { Timestamp } from "firebase/firestore";

// ── Enums ────────────────────────────────────────────────

export type UserRole = "admin" | "sales_rep";
export type TyreType = "bike" | "three_wheeler";
export type PaymentType = "cash" | "cheque_15d" | "cheque_30d" | "cheque_45d" | "cheque_60d";
export type InvoiceStatus = "draft" | "confirmed" | "delivered" | "cancelled";
export type ChequeStatus = "pending" | "deposited" | "bounced" | "cancelled";
export type TransferStatus = "pending" | "in_transit" | "completed" | "cancelled";
export type DispatchStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type DispatchStopStatus = "pending" | "delivered" | "skipped";

/**
 * UC Return status lifecycle:
 *
 *  approved
 *    → new tyre given to shop instantly (gaveTyreToShop: true)
 *    → physical tyre collected from shop (tyreReceivedFromShop: true)
 *
 *  sent_to_supplier
 *    → defective tyre physically sent to CEAT (sentToSupplierAt recorded)
 *
 *  awaiting_replacement
 *    → waiting for CEAT to send a new tyre back
 *
 *  closed
 *    → CEAT sent replacement, stock incremented (replacementReceivedAt recorded)
 */
export type UCReturnStatus =
  | "approved"
  | "sent_to_supplier"
  | "awaiting_replacement"
  | "closed";

export type UCReturnReason =
  | "sidewall_bulge"
  | "tread_separation"
  | "manufacturing_defect"
  | "bead_damage"
  | "other";

// ── Firestore Collections ────────────────────────────────

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: Timestamp;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: Timestamp;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: TyreType;
  size: string;
  unitPrice: number;
  active: boolean;
  createdAt: Timestamp;
}

export interface Stock {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productSku: string;
  productType: TyreType;
  qty: number;
  reorderLevel: number;
  updatedAt: Timestamp;
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  assignedWarehouseId: string;
  outstandingBalance: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  shopId: string;
  shopName: string;
  warehouseId: string;
  warehouseName: string;
  createdBy: string;
  paymentType: PaymentType;
  totalAmount: number;
  status: InvoiceStatus;
  invoiceDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  chequeId?: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cheque {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  shopId: string;
  shopName: string;
  chequeNo: string;
  bank: string;
  amount: number;
  dueDate: Timestamp;
  status: ChequeStatus;
  depositedAt?: Timestamp;
  bounceNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * UCReturn — tracks a defective tyre from approval → closed
 *
 * Key tracking fields:
 *   gaveTyreToShop        — did we instantly give a new tyre to the shop?
 *   gaveTyreToShopAt      — when
 *   tyreReceivedFromShop  — have we physically collected the defective tyre?
 *   tyreReceivedAt        — when
 *   sentToSupplierAt      — when sent to CEAT
 *   replacementReceivedAt — when CEAT sent replacement back
 */
export interface UCReturn {
  id: string;

  // Shop & product info
  shopId: string;
  shopName: string;
  shopCity: string;
  productId: string;
  productName: string;
  productSku: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  reason: UCReturnReason;
  reasonNotes?: string;

  // Status lifecycle
  status: UCReturnStatus;

  // Tracking flags — all the details you asked for
  gaveTyreToShop: boolean;       // did we give new tyre to shop instantly?
  gaveTyreToShopAt?: Timestamp;  // when

  tyreReceivedFromShop: boolean; // have we collected the defective tyre?
  tyreReceivedAt?: Timestamp;    // when

  sentToSupplierAt?: Timestamp;  // when sent to CEAT
  replacementReceivedAt?: Timestamp; // when CEAT replacement arrived

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockTransfer {
  id: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  productId: string;
  productName: string;
  productSku: string;
  qty: number;
  status: TransferStatus;
  createdBy: string;
  transferDate: Timestamp;
  completedAt?: Timestamp;
  notes?: string;
}

export interface Dispatch {
  id: string;
  lorryReg: string;
  lorryModel?: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  createdBy: string;
  status: DispatchStatus;
  totalStops: number;
  totalUnits: number;
  dispatchDate: Timestamp;
  completedAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
}

export interface DispatchStop {
  id: string;
  dispatchId: string;
  shopId: string;
  shopName: string;
  shopCity: string;
  stopOrder: number;
  items: { productName: string; qty: number }[];
  totalUnits: number;
  status: DispatchStopStatus;
  notes?: string;
  deliveredAt?: Timestamp;
  skippedReason?: string;
}
