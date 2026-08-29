import Dexie, { type Table } from 'dexie';
import type {
  ActivityLog,
  Category,
  DispatchRecord,
  JobWork,
  Payment,
  Product,
  ReceiptRecord,
  ReferenceRecord,
  SharedVariant,
  Vendor,
} from '../types';

export class PortalLocalDb extends Dexie {
  vendors!: Table<Vendor, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  jobWorks!: Table<JobWork, string>;
  receipts!: Table<ReceiptRecord, string>;
  dispatches!: Table<DispatchRecord, string>;
  payments!: Table<Payment, string>;
  activityLogs!: Table<ActivityLog, string>;
  references!: Table<ReferenceRecord, string>;
  sharedVariants!: Table<SharedVariant, string>;

  constructor() {
    super('shreenathji-portal-local-db');
    this.version(2).stores({
      vendors: 'id',
      categories: 'id',
      products: 'id',
      jobWorks: 'id',
      receipts: 'id',
      dispatches: 'id',
      payments: 'id',
      activityLogs: 'id',
    });
    this.version(3).stores({
      vendors: 'id',
      categories: 'id',
      products: 'id',
      jobWorks: 'id',
      receipts: 'id',
      dispatches: 'id',
      payments: 'id',
      activityLogs: 'id',
      references: 'id, referenceNumber',
    });
    this.version(4).stores({
      vendors: 'id',
      categories: 'id',
      products: 'id',
      jobWorks: 'id',
      receipts: 'id',
      dispatches: 'id',
      payments: 'id',
      activityLogs: 'id',
      references: 'id, referenceNumber',
      sharedVariants: 'id, name',
    });
  }
}

export const portalDb = new PortalLocalDb();

export async function clearLocalDatabase() {
  await portalDb.close();
  await portalDb.delete();
  await portalDb.open();
}

void portalDb.open();

// ── Fetch (read) ──────────────────────────────────────────────

export async function fetchVendors(): Promise<Vendor[]> {
  return portalDb.vendors.toArray();
}

export async function fetchCategories(): Promise<Category[]> {
  return portalDb.categories.toArray();
}

export async function fetchProducts(): Promise<Product[]> {
  return portalDb.products.toArray();
}

export async function fetchJobWorks(): Promise<JobWork[]> {
  return portalDb.jobWorks.toArray();
}

export async function fetchReceipts(): Promise<ReceiptRecord[]> {
  return portalDb.receipts.toArray();
}

export async function fetchDispatches(): Promise<DispatchRecord[]> {
  return portalDb.dispatches.toArray();
}

export async function fetchPayments(): Promise<Payment[]> {
  return portalDb.payments.toArray();
}

export async function fetchActivityLogs(): Promise<ActivityLog[]> {
  return portalDb.activityLogs.toArray();
}

// ── Write (upsert) ────────────────────────────────────────────

export async function saveVendor(vendor: Vendor): Promise<void> {
  await portalDb.vendors.put(vendor);
}

export async function saveCategory(category: Category): Promise<void> {
  await portalDb.categories.put(category);
}

export async function saveProduct(product: Product): Promise<void> {
  await portalDb.products.put(product);
}

export async function saveJobWork(jobWork: JobWork): Promise<void> {
  await portalDb.jobWorks.put(jobWork);
}

export async function saveDispatch(dispatch: DispatchRecord): Promise<void> {
  await portalDb.dispatches.put(dispatch);
}

export async function saveReceipt(receipt: ReceiptRecord): Promise<void> {
  await portalDb.receipts.put(receipt);
}

export async function savePayment(payment: Payment): Promise<void> {
  await portalDb.payments.put(payment);
}

export async function saveActivityLog(log: ActivityLog): Promise<void> {
  await portalDb.activityLogs.put(log);
}

// ── Legacy helpers (kept for backward compatibility) ──────────

export async function createVendor(vendor: Omit<Vendor, 'id'>): Promise<Vendor> {
  const record: Vendor = {
    ...vendor,
    id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    gstNumber: vendor.gstNumber ?? '',
    specialization: vendor.specialization ?? '',
    status: vendor.status as Vendor['status'],
  };
  await portalDb.vendors.put(record);
  return record;
}

export async function createReceipt(receipt: Omit<ReceiptRecord, 'id'>): Promise<ReceiptRecord> {
  const record: ReceiptRecord = {
    ...receipt,
    id: `rc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    items: receipt.items.map((item) => ({
      ...item,
      rejected: (item as { rejected?: number }).rejected ?? 0,
      loss: (item as { loss?: number }).loss ?? 0,
    })),
  };
  await portalDb.receipts.put(record);
  return record;
}

export async function fetchReferences(): Promise<ReferenceRecord[]> {
  return portalDb.references.toArray();
}

export async function saveReference(ref: ReferenceRecord): Promise<void> {
  await portalDb.references.put(ref);
}

export async function deleteReferenceRecord(id: string): Promise<void> {
  await portalDb.references.delete(id);
}

export async function fetchSharedVariants(): Promise<SharedVariant[]> {
  return portalDb.sharedVariants.toArray();
}

export async function saveSharedVariant(sv: SharedVariant): Promise<void> {
  await portalDb.sharedVariants.put(sv);
}

export async function deleteSharedVariantRecord(id: string): Promise<void> {
  await portalDb.sharedVariants.delete(id);
}

export async function deleteJobWorkRecord(id: string): Promise<void> {
  await portalDb.jobWorks.delete(id);
}

export async function deleteProductRecord(id: string): Promise<void> {
  await portalDb.products.delete(id);
}

export async function deleteCategoryRecord(id: string): Promise<void> {
  await portalDb.categories.delete(id);
}
