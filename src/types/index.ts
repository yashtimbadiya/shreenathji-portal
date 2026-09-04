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
}

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  code: string;
  unit: string;
  rate?: number;
  status: 'Active' | 'Disabled';
  variants: ProductVariant[];
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

export interface Payment {
  id: string;
  vendorId: string;
  jobWorkId: string;
  process: string;
  quantity: number;
  rate: number;
  amount: number;
  paid: number;
  status: 'Pending' | 'Partial' | 'Paid';
  paymentType: 'Advance' | 'Running' | 'Final' | 'Balance';
  date: string;
  remarks?: string;
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
