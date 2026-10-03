export type JobStatus =
  | 'Draft'
  | 'Sent'
  | 'Processing'
  | 'Partial'
  | 'Completed'
  | 'Overdue'
  | 'Rejected'
  | 'Cancelled';

export type ConnectionStatus =
  | 'Local Server Connected'
  | 'Cloud Synced'
  | 'Sync Pending'
  | 'Offline';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

export interface Settings {
  companyName: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  jobWorkPrefix: string;
  challanPrefix: string;
  receiptPrefix: string;
  invoicePrefix: string;
  /** Vendor payment receipt prefix, e.g. PR-YYYY-##### */
  paymentReceiptPrefix: string;
  /** Optional production rate card (per-meter by pick range + per-kg rates) */
  rateCard?: RateCard;
}

/** One row of the per-meter rate card, e.g. LB / maharani / JQ */
export interface RateCardMeterRow {
  /** Type label, e.g. "LB", "maharani", "JQ" */
  type: string;
  /** Rate for picks 1–70 */
  lowPickRate?: number;
  /** Rate for picks 71–100 */
  highPickRate?: number;
}

/** One row of the per-kg rate card, e.g. TONY PATTI */
export interface RateCardKgRow {
  type: string;
  rate?: number;
}

/** Production rate card (tab 3 of the workbook) */
export interface RateCard {
  /** Pick threshold separating low/high columns (default 70) */
  lowPickMax: number;
  meterRates: RateCardMeterRow[];
  kgRates: RateCardKgRow[];
}

export interface Category {
  id: string;
  name: string;
  status: 'Active' | 'Disabled';
  createdDate: string;
  productCount: number;
  /** Shared variant IDs that every sub-product in this category should inherit */
  sharedVariantIds?: string[];
}

export interface VariantAttribute {
  key: string;
  value: string;
}

/** A reusable variant definition that can be applied to any product */
export interface SharedVariant {
  id: string;
  name: string;          // e.g. "M", "L", "XXL", "Red", "25mm"
  sku: string;           // base SKU suffix, e.g. "M" → product SKU becomes "MAR-ELA-M"
  attributes: VariantAttribute[];
  status: 'Active' | 'Disabled';
  createdDate: string;
  remarks?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  attributes: VariantAttribute[];
  factoryStock: number;
  withVendor: number;
  rejected: number;
  status: 'Active' | 'Disabled';
  /** ID of the SharedVariant this was created from — enables name/sku sync on edit */
  sharedVariantId?: string;
}

/**
 * Textile manufacturing spec for a product, sourced from the production
 * "product master" sheet. All optional so existing products stay valid.
 */
export interface ProductSpec {
  /** Design number, e.g. "67", "3R" */
  designNo?: string;
  /** Folder code, e.g. "LB-67-46-320" */
  folderNo?: string;
  /** Colour combination, e.g. "MARUN + CHEMPIYEN" */
  colour?: string;
  /** Geping / gauge as a number, e.g. 1.25 (parsed from "GEPING -1.25") */
  geping?: number;
  /** Meters per roll, e.g. 9.20 */
  meterPerRoll?: number;
  /** Machine patti, e.g. 30 */
  machinePatti?: number;
  /** Pick, e.g. 46 */
  pick?: number;
  /** Rate per meter, e.g. 1.75 */
  ratePerMtr?: number;
  /** Cut mark code, e.g. "55-SNF-3RR - 320 ( I I I )" */
  cutMark?: string;
  /** MIR / mirical name code, e.g. "2- [0.50 MII ]MR-300/1.25" */
  mirName?: string;
  /** Free-text setup note (often Hindi), e.g. "290 तिकड़ी सेट करना हे" */
  tikdiNote?: string;
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  unit: string;
  createdAt?: string;
  rate?: number;
  status: 'Active' | 'Disabled';
  variants: ProductVariant[];
  /** Optional textile manufacturing spec (from product master import) */
  spec?: ProductSpec;
}

export interface ReferenceItem {
  productId: string;
  categoryId: string;
  variantId?: string;
  pieces: number;
}

export interface ReferenceRecord {
  id: string;
  referenceNumber: string;
  /** Legacy single-product fields — kept for backward compatibility */
  categoryId: string;
  productId: string;
  variantId?: string;
  pieces: number;
  /** Total weight for the entire reference (kg) */
  weight?: number;
  /** Multi-product line items (used when items.length > 0) */
  items?: ReferenceItem[];
  remarks?: string;
  createdDate: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson: string;
  mobile: string;
  gstNumber: string;
  specialization: string;
  status: 'Active' | 'Inactive';
  createdAt?: string;
  address?: string;
}

export interface JobWorkItem {
  id: string;
  productId: string;
  variantId: string;
  sentQuantity: number;
  receivedQuantity: number;
  rejectedQuantity: number;
  lossQuantity: number;
  rate?: number;
}

export interface JobWork {
  id: string;
  jobNumber: string;
  vendorId: string;
  process: string;
  issueDate: string;
  expectedReturnDate: string;
  priority: 'Normal' | 'High' | 'Urgent';
  reference?: string;
  remarks?: string;
  status: JobStatus;
  items: JobWorkItem[];
  createdBy: string;
  createdAt: string;
}

export interface DispatchRecord {
  id: string;
  jobWorkId: string;
  challanNumber: string;
  date: string;
  vehicleNumber: string;
  driver: string;
  transport: string;
  remarks?: string;
  items: { jobWorkItemId?: string; variantId: string; quantity: number; weight?: number }[];
  createdBy: string;
}

export interface ReceiptRecord {
  id: string;
  receiptNumber?: string;
  jobWorkId: string;
  date: string;
  receivedBy: string;
  vendorChallanNumber?: string;
  remarks?: string;
  items: {
    jobWorkItemId?: string;
    variantId: string;
    received: number;
    rejected: number;
    loss: number;
  }[];
  createdBy: string;
}

export interface StockTransaction {
  id: string;
  date: string;
  productId: string;
  variantId: string;
  transaction: string;
  reference: string;
  vendorId?: string;
  inQty: number;
  outQty: number;
  balance: number;
  user: string;
}

export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Other';

export interface Payment {
  id: string;
  vendorId: string;
  /** Optional — vendor-level (monthly) settlements are not tied to a single job. */
  jobWorkId?: string;
  process: string;
  quantity: number;
  rate: number;
  amount: number;
  paid: number;
  status: 'Pending' | 'Partial' | 'Paid';
  paymentType: 'Advance' | 'Running' | 'Final' | 'Balance';
  date: string;
  remarks?: string;
  /** Vendor-payment receipt number, e.g. PR-2026-00001 */
  receiptNumber?: string;
  /** How the money was paid */
  method?: PaymentMethod;
  /** Cheque no. / UTR / txn reference */
  reference?: string;
  /** Settlement period this payment covers, e.g. "2026-09" (YYYY-MM) */
  period?: string;
}

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  message: string;
  user: string;
  timestamp: string;
}

export interface SearchResult {
  type: 'Job Work' | 'Challan' | 'Product' | 'Variant' | 'Vendor';
  id: string;
  label: string;
  sublabel?: string;
  path: string;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/** One SIZE / ROUND pair on a challan (sizes are free-text: "S", "XL", "44", "3XL") */
export interface ChallanSizeLine {
  size: string;
  round: number;
}

/**
 * A challan / production dispatch record, sourced from the challan register
 * sheet. Self-contained (not tied to a JobWork) — mirrors the source data 1:1.
 */
export interface Challan {
  id: string;
  /** Challan number as text to preserve leading formatting, e.g. "2111" */
  challanNumber: string;
  /** ISO date (YYYY-MM-DD) */
  date: string;
  /** Raw product name from the sheet */
  productName: string;
  /** Resolved link to the Product master when the name matches; else undefined */
  productId?: string;
  designNo: string;
  pick: number;
  folderNo: string;
  /** Raw party name from the sheet, e.g. "KOTHARI", "EXTRA" */
  partyName: string;
  /** Resolved Vendor link for real (non-internal) parties */
  vendorId?: string;
  machinePatti: number;
  /** Meters per piece */
  mtrPerPic: number;
  /** SIZE/ROUND grid, empty pairs dropped */
  lines: ChallanSizeLine[];
  /** TOTAL PIC from the sheet (kept as-is, not recomputed) */
  totalPieces: number;
  /** TOTAL MTR from the sheet */
  totalMeters: number;
  /** How this record entered the system */
  source?: 'import' | 'manual';
}
