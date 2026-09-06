import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { USERS } from '../data/mockData';
import {
  fetchCategories,
  fetchJobWorks,
  fetchProducts,
  fetchVendors,
  fetchReceipts,
  fetchDispatches,
  fetchPayments,
  fetchActivityLogs,
  fetchReferences,
  fetchSharedVariants,
  saveCategory,
  saveProduct,
  saveJobWork,
  saveDispatch,
  savePayment,
  saveActivityLog,
  saveReference,
  saveSharedVariant,
  deleteReferenceRecord,
  deleteSharedVariantRecord,
  deleteJobWorkRecord,
  deleteProductRecord,
  deleteCategoryRecord,
  deleteVendorRecord,
  deletePaymentRecord,
  deleteDispatchRecord,
  deleteReceiptRecord,
  createVendor as createVendorRecord,
  createReceipt as createReceiptRecord,
  saveVendor,
} from '../api/supabaseSync';
import { scheduleBackup } from '../api/autoBackup';

import type {
  ActivityLog,
  Category,
  ConnectionStatus,
  DispatchRecord,
  JobWork,
  Payment,
  Product,
  ProductVariant,
  ReceiptRecord,
  ReferenceRecord,
  SharedVariant,
  Settings,
  StockTransaction,
  Toast,
  User,
  Vendor,
} from '../types';

interface AppState {
  currentUser: User | null;
  connectionStatus: ConnectionStatus;
  categories: Category[];
  products: Product[];
  users: User[];
  vendors: Vendor[];
  jobWorks: JobWork[];
  dispatches: DispatchRecord[];
  receipts: ReceiptRecord[];
  payments: Payment[];
  activityLogs: ActivityLog[];
  references: ReferenceRecord[];
  sharedVariants: SharedVariant[];
  stockTransactions: StockTransaction[];
  toasts: Toast[];
  jobCounter: number;
  challanCounter: number;

  login: (email: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  resetStore: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  addCategory: (name: string, sharedVariantIds?: string[]) => void;
  updateCategory: (id: string, data: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  addProduct: (product: Omit<Product, 'id' | 'variants'>) => void;
  updateProduct: (id: string, data: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addVariant: (productId: string, variant: Omit<ProductVariant, 'id' | 'productId'>) => void;
  updateVariant: (productId: string, variantId: string, data: Partial<Omit<ProductVariant, 'id' | 'productId'>>) => void;
  deleteVariant: (productId: string, variantId: string) => void;

  addVendor: (vendor: Omit<Vendor, 'id'>) => void;
  updateVendor: (id: string, data: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;

  settings: Settings;
  updateSettings: (data: Partial<Settings>) => void;

  createJobWork: (data: Omit<JobWork, 'id' | 'jobNumber' | 'createdAt' | 'status'> & { status?: JobWork['status'] }) => string;
  updateJobWork: (id: string, data: Partial<JobWork>) => void;
  deleteJobWork: (id: string) => void;

  createDispatch: (data: Omit<DispatchRecord, 'id' | 'challanNumber'>) => string;
  updateDispatch: (id: string, data: Partial<Pick<DispatchRecord, 'date' | 'vehicleNumber' | 'driver' | 'transport' | 'remarks'>>) => void;
  createReceipt: (data: Omit<ReceiptRecord, 'id'>) => void;
  loadLocalData: () => Promise<void>;
  recordPayment: (paymentId: string, amount: number) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  deletePayment: (id: string) => void;

  addReference: (ref: Omit<ReferenceRecord, 'id'>) => void;
  updateReference: (id: string, data: Partial<ReferenceRecord>) => void;
  deleteReference: (id: string) => void;

  addSharedVariant: (sv: Omit<SharedVariant, 'id' | 'createdDate'>) => void;
  seedDefaultSharedVariants: () => void;
  updateSharedVariant: (id: string, data: Partial<SharedVariant>) => void;
  deleteSharedVariant: (id: string) => void;

  addInventoryStock: (data: { variantId: string; quantity: number; reference: string; transaction: string }) => void;

  addActivity: (entityType: string, entityId: string, message: string) => void;

  // ── Referential integrity checks ─────────────────────────────────────────
  /** Returns an array of human-readable reasons why a category cannot be deleted (empty = safe to delete) */
  checkCategoryDeleteConstraints: (categoryId: string) => string[];
  /** Returns an array of human-readable reasons why a product (subproduct) cannot be deleted */
  checkProductDeleteConstraints: (productId: string) => string[];
  /** Returns an array of human-readable reasons why a variant cannot be deleted */
  checkVariantDeleteConstraints: (variantId: string) => string[];
  /** Returns an array of human-readable reasons why a vendor cannot be deleted */
  checkVendorDeleteConstraints: (vendorId: string) => string[];
  /** Returns an array of human-readable reasons why a shared variant cannot be deleted */
  checkSharedVariantDeleteConstraints: (svId: string) => string[];
  /** Returns an array of human-readable reasons why a job work cannot be deleted */
  checkJobWorkDeleteConstraints: (jobWorkId: string) => string[];
  /** Returns an array of human-readable reasons why a reference cannot be deleted */
  checkReferenceDeleteConstraints: (referenceId: string) => string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Default shared variants seeded on first load
// ─────────────────────────────────────────────────────────────────────────────
const SIZE_NAMES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];
const NUMBER_SIZES = Array.from({ length: 121 }, (_, i) => String(i)); // "0" … "120"

export const DEFAULT_SHARED_VARIANTS: Omit<SharedVariant, 'id' | 'createdDate'>[] = [
  ...SIZE_NAMES.map((name) => ({
    name,
    sku: name.toUpperCase(),
    attributes: [{ key: 'Size', value: name }],
    status: 'Active' as const,
  })),
  ...NUMBER_SIZES.map((n) => ({
    name: n,
    sku: n,
    attributes: [{ key: 'Size', value: n }],
    status: 'Active' as const,
  })),
];

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_SETTINGS: Settings = {
  companyName: 'Shreenathji Enterprise',
  gstin: '24AABCS1234R1ZP',
  address: 'Plot 45, GIDC Estate, Pandesara, Surat 394221',
  phone: '+91 261 2891234',
  email: 'info@shreenathji.co.in',
  website: 'www.shreenathji.co.in',
  jobWorkPrefix: 'JW-YYYY-#####',
  challanPrefix: 'CH-YYYY-#####',
  receiptPrefix: 'RC-YYYY-#####',
  invoicePrefix: 'INV-YYYY-#####',
};

function computeJobStatus(job: JobWork): JobWork['status'] {
  if (job.status === 'Draft' || job.status === 'Cancelled') return job.status;
  const sent = job.items.reduce((s, i) => s + i.sentQuantity, 0);
  const received = job.items.reduce((s, i) => s + i.receivedQuantity + i.rejectedQuantity + i.lossQuantity, 0);
  const pending = sent - received;
  const today = new Date().toISOString().slice(0, 10);
  if (sent === 0) return 'Draft';
  if (pending <= 0 && sent > 0) return 'Completed';
  if (received > 0 && pending > 0) {
    if (job.expectedReturnDate < today) return 'Overdue';
    return 'Partial';
  }
  if (job.expectedReturnDate < today && pending > 0) return 'Overdue';
  if (received === 0 && sent > 0) return job.status === 'Processing' ? 'Processing' : 'Sent';
  return job.status;
}

function normalizeProductUnit(product: Pick<Product, 'categoryId' | 'name' | 'unit'>): string {
  const isElastic = product.categoryId === 'cat1' || /elastic/i.test(product.name) || /meter/i.test(product.unit);
  return isElastic ? 'Pic' : product.unit;
}

function normalizeProductUnits(products: Product[] = []): Product[] {
  return products.map((product) => ({
    ...product,
    unit: normalizeProductUnit(product),
  }));
}

const BOOTSTRAP_STATE = {
  users: USERS,
  categories: [] as Category[],
  products: [] as Product[],
  vendors: [] as Vendor[],
  jobWorks: [] as JobWork[],
  dispatches: [] as DispatchRecord[],
  receipts: [] as ReceiptRecord[],
  payments: [] as Payment[],
  activityLogs: [] as ActivityLog[],
  references: [] as ReferenceRecord[],
  sharedVariants: [] as SharedVariant[],
  stockTransactions: [] as StockTransaction[],
  jobCounter: 0,
  challanCounter: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      connectionStatus: 'Local Server Connected',
      users: BOOTSTRAP_STATE.users,
      categories: BOOTSTRAP_STATE.categories,
      products: BOOTSTRAP_STATE.products,
      vendors: BOOTSTRAP_STATE.vendors,
      jobWorks: BOOTSTRAP_STATE.jobWorks,
      dispatches: BOOTSTRAP_STATE.dispatches,
      receipts: BOOTSTRAP_STATE.receipts,
      payments: BOOTSTRAP_STATE.payments,
      activityLogs: BOOTSTRAP_STATE.activityLogs,
      references: BOOTSTRAP_STATE.references,
      sharedVariants: BOOTSTRAP_STATE.sharedVariants,
      stockTransactions: BOOTSTRAP_STATE.stockTransactions,
      toasts: [],
      jobCounter: BOOTSTRAP_STATE.jobCounter,
      challanCounter: BOOTSTRAP_STATE.challanCounter,

      resetStore: () => {
        localStorage.removeItem('shreenathji-portal');
        set({
          currentUser: null,
          connectionStatus: 'Local Server Connected',
          users: BOOTSTRAP_STATE.users,
          categories: BOOTSTRAP_STATE.categories,
          products: BOOTSTRAP_STATE.products,
          vendors: BOOTSTRAP_STATE.vendors,
          jobWorks: BOOTSTRAP_STATE.jobWorks,
          dispatches: BOOTSTRAP_STATE.dispatches,
          receipts: BOOTSTRAP_STATE.receipts,
          payments: BOOTSTRAP_STATE.payments,
          activityLogs: BOOTSTRAP_STATE.activityLogs,
          references: BOOTSTRAP_STATE.references,
          sharedVariants: BOOTSTRAP_STATE.sharedVariants,
          stockTransactions: BOOTSTRAP_STATE.stockTransactions,
          toasts: [],
          jobCounter: BOOTSTRAP_STATE.jobCounter,
          challanCounter: BOOTSTRAP_STATE.challanCounter,
          settings: DEFAULT_SETTINGS,
        });
      },

      login: (identifier, password) => {
        const user = get().users.find(
          (u) => (u.email === identifier || u.id === identifier) && u.password === password,
        );
        if (user) {
          set({ currentUser: user });
          return true;
        }
        return false;
      },

      logout: () => {
        get().resetStore();
      },

      addUser: (user) => {
        const u: User = { ...user, id: generateId('u') };
        set((s) => ({ users: [u, ...s.users] }));
        get().addToast(`User "${user.name}" added`);
      },

      addToast: (message, type = 'success') => {
        const id = generateId('toast');
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), 4000);
      },

      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      addCategory: (name, sharedVariantIds) => {
        const cat: Category = {
          id: generateId('cat'),
          name,
          status: 'Active',
          createdDate: new Date().toISOString().slice(0, 10),
          productCount: 0,
          sharedVariantIds: sharedVariantIds && sharedVariantIds.length > 0 ? sharedVariantIds : undefined,
        };
        set((s) => ({ categories: [cat, ...s.categories] }));
        // persist to IndexedDB
        void saveCategory(cat);
        get().addActivity('Category', cat.id, `Category "${name}" created`);
        get().addToast(`Category "${name}" added`);
        scheduleBackup();
      },

      updateCategory: (id, data) => {
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
        // persist updated record to IndexedDB
        const updated = get().categories.find((c) => c.id === id);
        if (updated) void saveCategory(updated);
        scheduleBackup();
      },

      deleteCategory: (id) => {
        const cat = get().categories.find((c) => c.id === id);
        // Collect all products (and their variant IDs) under this category
        const relatedProducts = get().products.filter((p) => p.categoryId === id);
        const relatedVariantIds = new Set(
          relatedProducts.flatMap((p) => p.variants.map((v) => v.id)),
        );
        const relatedProductIds = new Set(relatedProducts.map((p) => p.id));

        // Cascade: find orphaned dispatches and receipts referencing these variants
        const orphanDispatches = get().dispatches.filter((d) =>
          d.items.some((i) => relatedVariantIds.has(i.variantId)),
        );
        const orphanReceipts = get().receipts.filter((r) =>
          r.items.some((i) => relatedVariantIds.has(i.variantId)),
        );

        // Cascade: find orphaned job works whose items touch these products, and their payments
        const orphanJobWorks = get().jobWorks.filter((j) =>
          j.items.some((i) => relatedProductIds.has(i.productId)),
        );
        const orphanJobWorkIds = new Set(orphanJobWorks.map((j) => j.id));
        const orphanPayments = get().payments.filter(
          (p) => p.jobWorkId != null && orphanJobWorkIds.has(p.jobWorkId),
        );

        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          products: s.products.filter((p) => p.categoryId !== id),
          dispatches: s.dispatches.filter((d) => !orphanDispatches.some((od) => od.id === d.id)),
          receipts: s.receipts.filter((r) => !orphanReceipts.some((or) => or.id === r.id)),
          jobWorks: s.jobWorks.filter((j) => !orphanJobWorkIds.has(j.id)),
          payments: s.payments.filter((p) => !orphanPayments.some((op) => op.id === p.id)),
        }));

        // Persist all cascaded deletes to IndexedDB
        void deleteCategoryRecord(id);
        relatedProducts.forEach((p) => void deleteProductRecord(p.id));
        orphanDispatches.forEach((d) => void deleteDispatchRecord(d.id));
        orphanReceipts.forEach((r) => void deleteReceiptRecord(r.id));
        orphanJobWorks.forEach((j) => void deleteJobWorkRecord(j.id));
        orphanPayments.forEach((p) => void deletePaymentRecord(p.id));

        get().addToast(`Product "${cat?.name ?? ''}" and all related data deleted`);
        scheduleBackup();
      },

      addProduct: (product) => {
        const normalizedUnit = normalizeProductUnit(product);
        const p: Product = { ...product, unit: normalizedUnit, id: generateId('p'), variants: [] };
        set((s) => ({
          products: [p, ...s.products],
          categories: s.categories.map((c) =>
            c.id === product.categoryId ? { ...c, productCount: c.productCount + 1 } : c,
          ),
        }));
        // persist to IndexedDB
        void saveProduct(p);
        const updatedCat = get().categories.find((c) => c.id === product.categoryId);
        if (updatedCat) void saveCategory(updatedCat);
        get().addToast(`Product "${product.name}" added`);
        scheduleBackup();

        // ── Auto-attach parent category's shared variants ────────────────
        const cat = get().categories.find((c) => c.id === product.categoryId);
        const svIds = cat?.sharedVariantIds ?? [];
        if (svIds.length > 0) {
          const allSVs = get().sharedVariants;
          const productCode = product.code ?? '';
          setTimeout(() => {
            // read the freshly inserted product by matching name+categoryId+code
            const { products: storeProducts, addVariant } = useAppStore.getState();
            const created = storeProducts.find(
              (sp) =>
                sp.name === product.name &&
                sp.categoryId === product.categoryId &&
                sp.code === productCode,
            );
            if (!created) return;
            svIds.forEach((svId) => {
              const sv = allSVs.find((s) => s.id === svId);
              if (!sv) return;
              addVariant(created.id, {
                name:            sv.name,
                sku:             productCode ? `${productCode}-${sv.sku}` : sv.sku,
                attributes:      sv.attributes,
                sharedVariantId: sv.id,
                factoryStock: 0,
                withVendor:   0,
                rejected:     0,
                status:       'Active' as const,
              });
            });
          }, 0);
        }
      },

      updateProduct: (id, data) => {
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
        const updated = get().products.find((p) => p.id === id);
        if (updated) void saveProduct(updated);
        scheduleBackup();
      },

      deleteProduct: (id) => {
        const product = get().products.find((p) => p.id === id);
        const variantIds = new Set(product?.variants.map((v) => v.id) ?? []);

        // Cascade: dispatches and receipts touching this product's variants
        const orphanDispatches = get().dispatches.filter((d) =>
          d.items.some((i) => variantIds.has(i.variantId)),
        );
        const orphanReceipts = get().receipts.filter((r) =>
          r.items.some((i) => variantIds.has(i.variantId)),
        );

        // Cascade: job works whose items reference this product, and their payments
        const orphanJobWorks = get().jobWorks.filter((j) =>
          j.items.some((i) => i.productId === id),
        );
        const orphanJobWorkIds = new Set(orphanJobWorks.map((j) => j.id));
        const orphanPayments = get().payments.filter(
          (p) => p.jobWorkId != null && orphanJobWorkIds.has(p.jobWorkId),
        );

        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          categories: s.categories.map((c) =>
            c.id === product?.categoryId
              ? { ...c, productCount: Math.max(0, c.productCount - 1) }
              : c,
          ),
          dispatches: s.dispatches.filter((d) => !orphanDispatches.some((od) => od.id === d.id)),
          receipts: s.receipts.filter((r) => !orphanReceipts.some((or) => or.id === r.id)),
          jobWorks: s.jobWorks.filter((j) => !orphanJobWorkIds.has(j.id)),
          payments: s.payments.filter((p) => !orphanPayments.some((op) => op.id === p.id)),
        }));

        void deleteProductRecord(id);
        orphanDispatches.forEach((d) => void deleteDispatchRecord(d.id));
        orphanReceipts.forEach((r) => void deleteReceiptRecord(r.id));
        orphanJobWorks.forEach((j) => void deleteJobWorkRecord(j.id));
        orphanPayments.forEach((p) => void deletePaymentRecord(p.id));

        // Persist updated category count
        const updatedCat = get().categories.find((c) => c.id === product?.categoryId);
        if (updatedCat) void saveCategory(updatedCat);

        get().addToast(`Subproduct "${product?.name ?? ''}" deleted`);
        scheduleBackup();
      },

      addVariant: (productId, variant) => {
        const v: ProductVariant = { ...variant, id: generateId('v'), productId };
        set((s) => ({
          products: s.products.map((p) =>
            p.id === productId ? { ...p, variants: [...p.variants, v] } : p,
          ),
        }));
        // persist the whole product (with new variant) to IndexedDB
        const updated = get().products.find((p) => p.id === productId);
        if (updated) void saveProduct(updated);
        get().addToast(`Variant "${variant.name}" added`);
        scheduleBackup();
      },

      updateVariant: (productId, variantId, data) => {
        set((s) => ({
          products: s.products.map((p) =>
            p.id !== productId ? p : {
              ...p,
              variants: p.variants.map((v) => v.id === variantId ? { ...v, ...data } : v),
            },
          ),
        }));
        const updated = get().products.find((p) => p.id === productId);
        if (updated) void saveProduct(updated);
        get().addToast('Variant updated');
        scheduleBackup();
      },

      deleteVariant: (productId, variantId) => {
        // Cascade: dispatches and receipts that include this specific variant
        const orphanDispatches = get().dispatches.filter((d) =>
          d.items.some((i) => i.variantId === variantId),
        );
        const orphanReceipts = get().receipts.filter((r) =>
          r.items.some((i) => i.variantId === variantId),
        );

        set((s) => ({
          products: s.products.map((p) =>
            p.id !== productId ? p : {
              ...p,
              variants: p.variants.filter((v) => v.id !== variantId),
            },
          ),
          dispatches: s.dispatches.filter((d) => !orphanDispatches.some((od) => od.id === d.id)),
          receipts: s.receipts.filter((r) => !orphanReceipts.some((or) => or.id === r.id)),
        }));

        const updated = get().products.find((p) => p.id === productId);
        if (updated) void saveProduct(updated);
        orphanDispatches.forEach((d) => void deleteDispatchRecord(d.id));
        orphanReceipts.forEach((r) => void deleteReceiptRecord(r.id));

        get().addToast('Variant removed');
        scheduleBackup();
      },

      addVendor: async (vendor) => {
        try {
          const saved = await createVendorRecord(vendor);
          if (saved) {
            set((s) => ({ vendors: [saved, ...s.vendors] }));
            get().addToast(`Vendor "${saved.name}" added`);
            scheduleBackup();
          }
        } catch (error) {
          get().addToast('Unable to save vendor to local database', 'error');
        }
      },

      updateVendor: (id, data) => {
        set((s) => ({
          vendors: s.vendors.map((v) => (v.id === id ? { ...v, ...data } : v)),
        }));
        const updated = get().vendors.find((v) => v.id === id);
        if (updated) void saveVendor(updated);
        scheduleBackup();
      },

      deleteVendor: (id) => {
        const vendor = get().vendors.find((v) => v.id === id);

        // Cascade: remove all job works for this vendor, and their dispatches/receipts/payments
        const orphanJobWorks = get().jobWorks.filter((j) => j.vendorId === id);
        const orphanJobWorkIds = new Set(orphanJobWorks.map((j) => j.id));
        const orphanDispatches = get().dispatches.filter((d) => orphanJobWorkIds.has(d.jobWorkId));
        const orphanReceipts = get().receipts.filter((r) => orphanJobWorkIds.has(r.jobWorkId));
        const orphanPayments = get().payments.filter(
          (p) => p.jobWorkId != null && orphanJobWorkIds.has(p.jobWorkId),
        );

        set((s) => ({
          vendors: s.vendors.filter((v) => v.id !== id),
          jobWorks: s.jobWorks.filter((j) => !orphanJobWorkIds.has(j.id)),
          dispatches: s.dispatches.filter((d) => !orphanDispatches.some((od) => od.id === d.id)),
          receipts: s.receipts.filter((r) => !orphanReceipts.some((or) => or.id === r.id)),
          payments: s.payments.filter((p) => !orphanPayments.some((op) => op.id === p.id)),
        }));

        void deleteVendorRecord(id);
        orphanJobWorks.forEach((j) => void deleteJobWorkRecord(j.id));
        orphanDispatches.forEach((d) => void deleteDispatchRecord(d.id));
        orphanReceipts.forEach((r) => void deleteReceiptRecord(r.id));
        orphanPayments.forEach((p) => void deletePaymentRecord(p.id));

        get().addToast(`Vendor "${vendor?.name ?? ''}" deleted`);
        scheduleBackup();
      },

      // Load everything from IndexedDB into the Zustand store.
      // Uses IndexedDB as the source of truth; falls back gracefully if empty.
      loadLocalData: async () => {
        try {
          const [categories, products, jobWorks, vendors, receipts, dispatches, payments, activityLogs, references, sharedVariants] =
            await Promise.all([
              fetchCategories(),
              fetchProducts(),
              fetchJobWorks(),
              fetchVendors(),
              fetchReceipts(),
              fetchDispatches(),
              fetchPayments(),
              fetchActivityLogs(),
              fetchReferences(),
              fetchSharedVariants(),
            ]);

          const maxJobCounter = (jobWorks ?? []).reduce((max, j) => {
            const num = parseInt(j.jobNumber.split('-').pop() ?? '0', 10);
            return num > max ? num : max;
          }, 0);
          const maxChallanCounter = (dispatches ?? []).reduce((max, d) => {
            const num = parseInt(d.challanNumber.split('-').pop() ?? '0', 10);
            return num > max ? num : max;
          }, 0);

          set({
            categories: categories ?? [],
            products: normalizeProductUnits(products ?? []),
            jobWorks: jobWorks ?? [],
            vendors: vendors ?? [],
            receipts: receipts ?? [],
            dispatches: dispatches ?? [],
            payments: payments ?? [],
            activityLogs: activityLogs ?? [],
            references: references ?? [],
            sharedVariants: sharedVariants ?? [],
            jobCounter: maxJobCounter,
            challanCounter: maxChallanCounter,
            connectionStatus: 'Local Server Connected',
          });

          // ── Seed default shared variants if none exist yet (first-time setup)
          if ((sharedVariants ?? []).length === 0) {
            const today = new Date().toISOString().slice(0, 10);
            const seeded: SharedVariant[] = DEFAULT_SHARED_VARIANTS.map((sv) => ({
              ...sv,
              id: generateId('sv'),
              createdDate: today,
            }));
            set({ sharedVariants: seeded });
            seeded.forEach((sv) => void saveSharedVariant(sv));
          }
        } catch (error) {
          console.error('IndexedDB load failed', error);
          set({ connectionStatus: 'Offline' });
        }
      },


      settings: DEFAULT_SETTINGS,
      updateSettings: (data) => {
        set((s) => ({ settings: { ...s.settings, ...data } }));
        get().addToast('Settings updated successfully');
      },

      createJobWork: (data) => {
        const counter = get().jobCounter + 1;
        const jobNumber = `JW-2026-${String(counter).padStart(5, '0')}`;
        const job: JobWork = {
          ...data,
          id: generateId('jw'),
          jobNumber,
          status: data.status ?? 'Draft',
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ jobWorks: [job, ...s.jobWorks], jobCounter: counter }));
        // persist to IndexedDB
        void saveJobWork(job);
        get().addActivity('JobWork', job.id, `${get().currentUser?.name ?? 'User'} created ${jobNumber}`);
        get().addToast(`Job Work ${jobNumber} created`);
        scheduleBackup();
        return job.id;
      },

      updateJobWork: (id, data) => {
        set((s) => ({
          jobWorks: s.jobWorks.map((j) => {
            if (j.id !== id) return j;
            const updated = { ...j, ...data };
            return { ...updated, status: computeJobStatus(updated) };
          }),
        }));
        const updated = get().jobWorks.find((j) => j.id === id);
        if (updated) void saveJobWork(updated);
        scheduleBackup();
      },

      deleteJobWork: (id) => {
        const job = get().jobWorks.find((j) => j.id === id);

        // Cascade: remove dispatches, receipts, and payments linked to this job work
        const orphanDispatches = get().dispatches.filter((d) => d.jobWorkId === id);
        const orphanReceipts = get().receipts.filter((r) => r.jobWorkId === id);
        const orphanPayments = get().payments.filter((p) => p.jobWorkId === id);

        set((s) => ({
          jobWorks: s.jobWorks.filter((j) => j.id !== id),
          dispatches: s.dispatches.filter((d) => !orphanDispatches.some((od) => od.id === d.id)),
          receipts: s.receipts.filter((r) => !orphanReceipts.some((or) => or.id === r.id)),
          payments: s.payments.filter((p) => !orphanPayments.some((op) => op.id === p.id)),
        }));

        void deleteJobWorkRecord(id);
        orphanDispatches.forEach((d) => void deleteDispatchRecord(d.id));
        orphanReceipts.forEach((r) => void deleteReceiptRecord(r.id));
        orphanPayments.forEach((p) => void deletePaymentRecord(p.id));

        get().addActivity('JobWork', id, `Job Work ${job?.jobNumber ?? id} deleted`);
        get().addToast(`Job Work ${job?.jobNumber ?? ''} deleted`);
        scheduleBackup();
      },

      createDispatch: (data) => {
        const counter = get().challanCounter + 1;
        const challanNumber = `CH-2026-${String(counter).padStart(5, '0')}`;
        const dispatch: DispatchRecord = {
          ...data,
          id: generateId('d'),
          challanNumber,
        };

        set((s) => {
          const jobWorks = s.jobWorks.map((j) => {
            if (j.id !== data.jobWorkId) return j;
            const items = j.items.map((item) => {
              const di = data.items.find(
                (d) => (d.jobWorkItemId && d.jobWorkItemId === item.id) || (!d.jobWorkItemId && d.variantId === item.variantId),
              );
              if (!di) return item;
              return { ...item, sentQuantity: item.sentQuantity + di.quantity };
            });
            const updatedJob = { ...j, items, status: 'Sent' as const };
            return { ...updatedJob, status: computeJobStatus(updatedJob) };
          });

          return {
            dispatches: [dispatch, ...s.dispatches],
            challanCounter: counter,
            jobWorks,
          };
        });

        // persist dispatch and updated job to IndexedDB
        void saveDispatch(dispatch);
        const updatedJob = get().jobWorks.find((j) => j.id === data.jobWorkId);
        if (updatedJob) void saveJobWork(updatedJob);

        get().addActivity('JobWork', data.jobWorkId, 'Material dispatched');
        get().addToast('Material dispatched successfully');
        scheduleBackup();
        return dispatch.id;
      },

      updateDispatch: (id, data) => {
        set((s) => ({
          dispatches: s.dispatches.map((d) => (d.id !== id ? d : { ...d, ...data })),
        }));
        const updated = get().dispatches.find((d) => d.id === id);
        if (updated) void saveDispatch(updated);
        get().addActivity('JobWork', updated?.jobWorkId ?? '', 'Challan updated');
        get().addToast('Challan updated');
        scheduleBackup();
      },

      createReceipt: async (data) => {
        try {
          const saved = await createReceiptRecord(data);
          if (!saved) {
            get().addToast('Unable to save receipt to local database', 'error');
            return;
          }

          set((s) => {
            const jobWorks = s.jobWorks.map((j) => {
              if (j.id !== data.jobWorkId) return j;
              const items = j.items.map((item) => {
                const ri = data.items.find(
                  (r) =>
                    (r.jobWorkItemId && r.jobWorkItemId === item.id) ||
                    (!r.jobWorkItemId && r.variantId === item.variantId),
                );
                if (!ri) return item;
                return {
                  ...item,
                  receivedQuantity: item.receivedQuantity + ri.received,
                  rejectedQuantity: item.rejectedQuantity,
                  lossQuantity: item.lossQuantity,
                };
              });
              const updatedJob = { ...j, items };
              return { ...updatedJob, status: computeJobStatus(updatedJob) };
            });
            return { receipts: [saved, ...s.receipts], jobWorks };
          });

          // persist updated job to IndexedDB
          const updatedJob = get().jobWorks.find((j) => j.id === data.jobWorkId);
          if (updatedJob) void saveJobWork(updatedJob);

          get().addActivity('JobWork', data.jobWorkId, 'Material received');
          get().addToast('Receipt confirmed successfully');
          scheduleBackup();
        } catch (error) {
          get().addToast('Unable to save receipt to local database', 'error');
        }
      },

      recordPayment: (paymentId, amount) => {
        set((s) => ({
          payments: s.payments.map((p) => {
            if (p.id !== paymentId) return p;
            const paid = p.paid + amount;
            const status = paid >= p.amount ? 'Paid' : paid > 0 ? 'Partial' : 'Pending';
            return { ...p, paid, status };
          }),
        }));
        const updated = get().payments.find((p) => p.id === paymentId);
        if (updated) void savePayment(updated);
        get().addToast('Payment recorded');
        scheduleBackup();
      },

      addPayment: (payment) => {
        const p: Payment = { ...payment, id: generateId('pay') };
        set((s) => ({ payments: [p, ...s.payments] }));
        void savePayment(p);
        get().addToast('Payment saved');
        scheduleBackup();
      },

      deletePayment: (id) => {
        set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }));
        void deletePaymentRecord(id);
        get().addToast('Payment entry deleted');
        scheduleBackup();
      },

      addReference: (ref) => {
        const existing = get().references.find((r) => r.referenceNumber === ref.referenceNumber);
        if (existing) {
          get().addToast(`Reference number "${ref.referenceNumber}" already exists`, 'error');
          return;
        }
        const record: ReferenceRecord = { ...ref, id: generateId('ref') };
        set((s) => ({ references: [record, ...s.references] }));
        void saveReference(record);
        get().addToast(`Reference "${ref.referenceNumber}" added`);
        scheduleBackup();
      },

      updateReference: (id, data) => {
        set((s) => ({
          references: s.references.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }));
        const updated = get().references.find((r) => r.id === id);
        if (updated) void saveReference(updated);
        scheduleBackup();
      },

      deleteReference: (id) => {
        const ref = get().references.find((r) => r.id === id);

        // Unlink: clear the reference field on any job works that point to this reference number
        if (ref) {
          const linkedJobIds = get().jobWorks
            .filter((j) => j.reference?.trim().toLowerCase() === ref.referenceNumber.trim().toLowerCase())
            .map((j) => j.id);

          if (linkedJobIds.length > 0) {
            set((s) => ({
              jobWorks: s.jobWorks.map((j) =>
                linkedJobIds.includes(j.id) ? { ...j, reference: '' } : j,
              ),
            }));
            // Persist the updated job works to IndexedDB
            linkedJobIds.forEach((jid) => {
              const updated = get().jobWorks.find((j) => j.id === jid);
              if (updated) void saveJobWork(updated);
            });
          }
        }

        set((s) => ({ references: s.references.filter((r) => r.id !== id) }));
        void deleteReferenceRecord(id);
        get().addToast('Reference deleted');
        scheduleBackup();
      },

      addSharedVariant: (sv) => {
        const record: SharedVariant = {
          ...sv,
          id: generateId('sv'),
          createdDate: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ sharedVariants: [record, ...s.sharedVariants] }));
        void saveSharedVariant(record);
        get().addToast(`Shared variant "${sv.name}" added`);
        scheduleBackup();
      },

      seedDefaultSharedVariants: () => {
        const today = new Date().toISOString().slice(0, 10);
        const existing = new Set(get().sharedVariants.map((sv) => sv.name.toUpperCase()));
        const toAdd: SharedVariant[] = DEFAULT_SHARED_VARIANTS
          .filter((sv) => !existing.has(sv.name.toUpperCase()))
          .map((sv) => ({ ...sv, id: generateId('sv'), createdDate: today }));
        if (toAdd.length === 0) {
          get().addToast('All default variants already exist', 'info');
          return;
        }
        set((s) => ({ sharedVariants: [...s.sharedVariants, ...toAdd] }));
        toAdd.forEach((sv) => void saveSharedVariant(sv));
        get().addToast(`${toAdd.length} default variant${toAdd.length !== 1 ? 's' : ''} added`);
        scheduleBackup();
      },

      updateSharedVariant: (id, data) => {
        set((s) => ({
          sharedVariants: s.sharedVariants.map((sv) => (sv.id === id ? { ...sv, ...data } : sv)),
        }));
        const updated = get().sharedVariants.find((sv) => sv.id === id);
        if (updated) void saveSharedVariant(updated);

        // ── Cascade: propagate name / sku / attributes to all product variants
        //    that were created from this shared variant (linked by sharedVariantId).
        //    The variant's own SKU is prefixed with the product code, so we rebuild it.
        const changedFields = Object.keys(data) as Array<keyof typeof data>;
        const needsSync = changedFields.some((k) => ['name', 'sku', 'attributes'].includes(k));
        if (needsSync && updated) {
          const affectedProducts: Set<string> = new Set();
          set((s) => ({
            products: s.products.map((product) => {
              const hasLinked = product.variants.some((v) => v.sharedVariantId === id);
              if (!hasLinked) return product;
              affectedProducts.add(product.id);
              return {
                ...product,
                variants: product.variants.map((v) => {
                  if (v.sharedVariantId !== id) return v;
                  // Rebuild sku: keep the product-code prefix if present
                  const existingPrefix = v.sku.includes('-') ? v.sku.split('-').slice(0, -1).join('-') : '';
                  const newSku = data.sku !== undefined
                    ? (existingPrefix ? `${existingPrefix}-${updated.sku}` : updated.sku)
                    : v.sku;
                  return {
                    ...v,
                    name:       data.name       !== undefined ? updated.name       : v.name,
                    sku:        newSku,
                    attributes: data.attributes !== undefined ? updated.attributes : v.attributes,
                  };
                }),
              };
            }),
          }));
          // Persist every affected product to IndexedDB
          const finalProducts = get().products;
          affectedProducts.forEach((pid) => {
            const p = finalProducts.find((prod) => prod.id === pid);
            if (p) void saveProduct(p);
          });
          if (affectedProducts.size > 0) {
            get().addToast(
              `Shared variant updated — synced across ${affectedProducts.size} subproduct${affectedProducts.size !== 1 ? 's' : ''}`,
            );
          } else {
            get().addToast('Shared variant updated');
          }
        } else {
          get().addToast('Shared variant updated');
        }

        scheduleBackup();
      },

      deleteSharedVariant: (id) => {
        set((s) => ({ sharedVariants: s.sharedVariants.filter((sv) => sv.id !== id) }));
        void deleteSharedVariantRecord(id);
        get().addToast('Shared variant deleted');
        scheduleBackup();
      },

      addInventoryStock: ({ variantId, quantity, reference, transaction }) => {
        // Find which product owns this variant so we can update factoryStock
        const products = get().products;
        const product = products.find((p) => p.variants.some((v) => v.id === variantId));
        if (!product) return;

        // Update the variant's factoryStock
        set((s) => ({
          products: s.products.map((p) =>
            p.id !== product.id ? p : {
              ...p,
              variants: p.variants.map((v) =>
                v.id !== variantId ? v : { ...v, factoryStock: v.factoryStock + quantity },
              ),
            },
          ),
        }));
        const updatedProduct = get().products.find((p) => p.id === product.id);
        if (updatedProduct) void saveProduct(updatedProduct);

        // Record the stock transaction
        const prevBalance = (product.variants.find((v) => v.id === variantId)?.factoryStock ?? 0);
        const txn: StockTransaction = {
          id: generateId('stk'),
          date: new Date().toISOString().slice(0, 10),
          productId: product.id,
          variantId,
          transaction,
          reference,
          inQty: quantity,
          outQty: 0,
          balance: prevBalance + quantity,
          user: get().currentUser?.name ?? 'System',
        };
        set((s) => ({ stockTransactions: [txn, ...s.stockTransactions] }));
        get().addToast(`Inventory updated — +${quantity} added`);
      },

      addActivity: (entityType, entityId, message) => {
        const log: ActivityLog = {
          id: generateId('a'),
          entityType,
          entityId,
          message,
          user: get().currentUser?.name ?? 'System',
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ activityLogs: [log, ...s.activityLogs] }));
        void saveActivityLog(log);
      },

      // ── Referential integrity checks ──────────────────────────────────────

      checkCategoryDeleteConstraints: (categoryId) => {
        const { products, jobWorks, references, dispatches, receipts } = get();
        const reasons: string[] = [];

        // Collect all productIds under this category
        const productIds = new Set(
          products.filter((p) => p.categoryId === categoryId).map((p) => p.id),
        );
        if (productIds.size === 0) return reasons; // nothing to check

        // Collect all variantIds under those products
        const variantIds = new Set<string>();
        products.filter((p) => productIds.has(p.id)).forEach((p) =>
          p.variants.forEach((v) => variantIds.add(v.id)),
        );

        const activeJobCount = jobWorks.filter((j) =>
          !['Completed', 'Cancelled', 'Draft'].includes(j.status) &&
          j.items.some((i) => productIds.has(i.productId)),
        ).length;
        if (activeJobCount > 0)
          reasons.push(`${activeJobCount} active job work${activeJobCount !== 1 ? 's' : ''} reference subproducts in this product.`);

        const refCount = references.filter((r) => {
          const items = (r.items && r.items.length > 0)
            ? r.items
            : [{ productId: r.productId, categoryId: r.categoryId }];
          return items.some((i) => productIds.has(i.productId));
        }).length;
        if (refCount > 0)
          reasons.push(`${refCount} reference record${refCount !== 1 ? 's' : ''} are linked to subproducts in this product.`);

        const dispatchCount = dispatches.filter((d) =>
          d.items.some((i) => variantIds.has(i.variantId)),
        ).length;
        if (dispatchCount > 0)
          reasons.push(`${dispatchCount} dispatch challan${dispatchCount !== 1 ? 's' : ''} contain variants from this product.`);

        const receiptCount = receipts.filter((r) =>
          r.items.some((i) => variantIds.has(i.variantId)),
        ).length;
        if (receiptCount > 0)
          reasons.push(`${receiptCount} receipt record${receiptCount !== 1 ? 's' : ''} contain variants from this product.`);

        return reasons;
      },

      checkProductDeleteConstraints: (productId) => {
        const { products, jobWorks, references, dispatches, receipts } = get();
        const reasons: string[] = [];

        const product = products.find((p) => p.id === productId);
        const variantIds = new Set(product?.variants.map((v) => v.id) ?? []);

        const activeJobCount = jobWorks.filter((j) =>
          !['Completed', 'Cancelled', 'Draft'].includes(j.status) &&
          j.items.some((i) => i.productId === productId),
        ).length;
        if (activeJobCount > 0)
          reasons.push(`${activeJobCount} active job work${activeJobCount !== 1 ? 's' : ''} reference this subproduct.`);

        const refCount = references.filter((r) => {
          const items = (r.items && r.items.length > 0)
            ? r.items
            : [{ productId: r.productId, categoryId: r.categoryId }];
          return items.some((i) => i.productId === productId);
        }).length;
        if (refCount > 0)
          reasons.push(`${refCount} reference record${refCount !== 1 ? 's' : ''} are linked to this subproduct.`);

        const dispatchCount = dispatches.filter((d) =>
          d.items.some((i) => variantIds.has(i.variantId)),
        ).length;
        if (dispatchCount > 0)
          reasons.push(`${dispatchCount} dispatch challan${dispatchCount !== 1 ? 's' : ''} contain variants of this subproduct.`);

        const receiptCount = receipts.filter((r) =>
          r.items.some((i) => variantIds.has(i.variantId)),
        ).length;
        if (receiptCount > 0)
          reasons.push(`${receiptCount} receipt record${receiptCount !== 1 ? 's' : ''} contain variants of this subproduct.`);

        return reasons;
      },

      checkVariantDeleteConstraints: (variantId) => {
        const { jobWorks, dispatches, receipts } = get();
        const reasons: string[] = [];

        const activeJobCount = jobWorks.filter((j) =>
          !['Completed', 'Cancelled'].includes(j.status) &&
          j.items.some((i) => i.variantId === variantId),
        ).length;
        if (activeJobCount > 0)
          reasons.push(`${activeJobCount} active job work${activeJobCount !== 1 ? 's' : ''} include this variant.`);

        const dispatchCount = dispatches.filter((d) =>
          d.items.some((i) => i.variantId === variantId),
        ).length;
        if (dispatchCount > 0)
          reasons.push(`${dispatchCount} dispatch challan${dispatchCount !== 1 ? 's' : ''} include this variant.`);

        const receiptCount = receipts.filter((r) =>
          r.items.some((i) => i.variantId === variantId),
        ).length;
        if (receiptCount > 0)
          reasons.push(`${receiptCount} receipt record${receiptCount !== 1 ? 's' : ''} include this variant.`);

        return reasons;
      },

      checkVendorDeleteConstraints: (vendorId) => {
        const { jobWorks, payments } = get();
        const reasons: string[] = [];

        const activeJobCount = jobWorks.filter((j) =>
          j.vendorId === vendorId && !['Completed', 'Cancelled', 'Draft'].includes(j.status),
        ).length;
        if (activeJobCount > 0)
          reasons.push(`${activeJobCount} active job work${activeJobCount !== 1 ? 's' : ''} are assigned to this vendor.`);

        const allJobCount = jobWorks.filter((j) => j.vendorId === vendorId).length;
        if (allJobCount > 0 && activeJobCount === 0)
          reasons.push(`${allJobCount} completed/draft job work${allJobCount !== 1 ? 's' : ''} are linked to this vendor.`);

        const paymentCount = payments.filter((p) => p.vendorId === vendorId).length;
        if (paymentCount > 0)
          reasons.push(`${paymentCount} payment record${paymentCount !== 1 ? 's' : ''} are linked to this vendor.`);

        return reasons;
      },

      checkSharedVariantDeleteConstraints: (svId) => {
        const { categories } = get();
        const reasons: string[] = [];

        const inheritingCats = categories.filter((c) =>
          c.sharedVariantIds?.includes(svId),
        );
        if (inheritingCats.length > 0) {
          const names = inheritingCats.map((c) => `"${c.name}"`).join(', ');
          reasons.push(
            `${inheritingCats.length} product${inheritingCats.length !== 1 ? 's' : ''} inherit this variant: ${names}.`,
          );
        }

        return reasons;
      },

      checkJobWorkDeleteConstraints: (jobWorkId) => {
        const { dispatches, receipts, payments } = get();
        const reasons: string[] = [];

        const dispatchCount = dispatches.filter((d) => d.jobWorkId === jobWorkId).length;
        if (dispatchCount > 0)
          reasons.push(`${dispatchCount} dispatch challan${dispatchCount !== 1 ? 's' : ''} are linked to this job work.`);

        const receiptCount = receipts.filter((r) => r.jobWorkId === jobWorkId).length;
        if (receiptCount > 0)
          reasons.push(`${receiptCount} receipt record${receiptCount !== 1 ? 's' : ''} are linked to this job work.`);

        const paymentCount = payments.filter((p) => p.jobWorkId === jobWorkId).length;
        if (paymentCount > 0)
          reasons.push(`${paymentCount} payment record${paymentCount !== 1 ? 's' : ''} are linked to this job work.`);

        return reasons;
      },

      checkReferenceDeleteConstraints: (referenceId) => {
        const { references, jobWorks } = get();
        const reasons: string[] = [];

        const ref = references.find((r) => r.id === referenceId);
        if (!ref) return reasons;

        const linkedJobCount = jobWorks.filter(
          (j) => j.reference?.trim().toLowerCase() === ref.referenceNumber.trim().toLowerCase(),
        ).length;
        if (linkedJobCount > 0)
          reasons.push(`${linkedJobCount} job work${linkedJobCount !== 1 ? 's' : ''} use this reference number.`);

        return reasons;
      },
    }),
    {
      name: 'shreenathji-portal',
      partialize: (s) => ({
        currentUser: s.currentUser,
        users: s.users,
        settings: s.settings,
        // NOTE: all other data is persisted in IndexedDB and loaded via loadLocalData.
        // We keep only auth + settings in localStorage as a fast bootstrap.
      }),
    },
  ),
);
