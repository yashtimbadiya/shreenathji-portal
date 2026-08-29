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
  createVendor as createVendorRecord,
  createReceipt as createReceiptRecord,
  saveVendor,
} from '../api/supabaseSync';
import { clearLocalDatabase } from '../api/supabaseClient';
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

  addCategory: (name: string) => void;
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

  settings: Settings;
  updateSettings: (data: Partial<Settings>) => void;

  createJobWork: (data: Omit<JobWork, 'id' | 'jobNumber' | 'createdAt' | 'status'> & { status?: JobWork['status'] }) => string;
  updateJobWork: (id: string, data: Partial<JobWork>) => void;
  deleteJobWork: (id: string) => void;

  createDispatch: (data: Omit<DispatchRecord, 'id' | 'challanNumber'>) => string;
  createReceipt: (data: Omit<ReceiptRecord, 'id'>) => void;
  loadLocalData: () => Promise<void>;
  clearAllLocalData: () => Promise<void>;
  recordPayment: (paymentId: string, amount: number) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;

  addReference: (ref: Omit<ReferenceRecord, 'id'>) => void;
  updateReference: (id: string, data: Partial<ReferenceRecord>) => void;
  deleteReference: (id: string) => void;

  addSharedVariant: (sv: Omit<SharedVariant, 'id' | 'createdDate'>) => void;
  updateSharedVariant: (id: string, data: Partial<SharedVariant>) => void;
  deleteSharedVariant: (id: string) => void;

  addInventoryStock: (data: { variantId: string; quantity: number; reference: string; transaction: string }) => void;

  addActivity: (entityType: string, entityId: string, message: string) => void;
}

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

      addCategory: (name) => {
        const cat: Category = {
          id: generateId('cat'),
          name,
          status: 'Active',
          createdDate: new Date().toISOString().slice(0, 10),
          productCount: 0,
        };
        set((s) => ({ categories: [cat, ...s.categories] }));
        // persist to IndexedDB
        void saveCategory(cat);
        get().addActivity('Category', cat.id, `Category "${name}" created`);
        get().addToast(`Category "${name}" added`);
      },

      updateCategory: (id, data) => {
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
        // persist updated record to IndexedDB
        const updated = get().categories.find((c) => c.id === id);
        if (updated) void saveCategory(updated);
      },

      deleteCategory: (id) => {
        const cat = get().categories.find((c) => c.id === id);
        // also remove all products belonging to this category
        const relatedProducts = get().products.filter((p) => p.categoryId === id);
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          products: s.products.filter((p) => p.categoryId !== id),
        }));
        void deleteCategoryRecord(id);
        relatedProducts.forEach((p) => void deleteProductRecord(p.id));
        get().addToast(`Product "${cat?.name ?? ''}" deleted`);
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
      },

      updateProduct: (id, data) => {
        set((s) => ({
          products: s.products.map((p) => (p.id === id ? { ...p, ...data } : p)),
        }));
        const updated = get().products.find((p) => p.id === id);
        if (updated) void saveProduct(updated);
      },

      deleteProduct: (id) => {
        const product = get().products.find((p) => p.id === id);
        set((s) => ({
          products: s.products.filter((p) => p.id !== id),
          categories: s.categories.map((c) =>
            c.id === product?.categoryId
              ? { ...c, productCount: Math.max(0, c.productCount - 1) }
              : c,
          ),
        }));
        void deleteProductRecord(id);
        get().addToast(`Subproduct "${product?.name ?? ''}" deleted`);
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
      },

      deleteVariant: (productId, variantId) => {
        set((s) => ({
          products: s.products.map((p) =>
            p.id !== productId ? p : {
              ...p,
              variants: p.variants.filter((v) => v.id !== variantId),
            },
          ),
        }));
        const updated = get().products.find((p) => p.id === productId);
        if (updated) void saveProduct(updated);
        get().addToast('Variant removed');
      },

      addVendor: async (vendor) => {
        try {
          const saved = await createVendorRecord(vendor);
          if (saved) {
            set((s) => ({ vendors: [saved, ...s.vendors] }));
            get().addToast(`Vendor "${saved.name}" added`);
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
        } catch (error) {
          console.error('IndexedDB load failed', error);
          set({ connectionStatus: 'Offline' });
        }
      },

      clearAllLocalData: async () => {
        localStorage.removeItem('shreenathji-portal');
        try {
          await clearLocalDatabase();
        } catch (error) {
          console.error('Unable to clear local IndexedDB database', error);
        }

        set({
          currentUser: null,
          connectionStatus: 'Local Server Connected',
          users: USERS,
          categories: [],
          products: [],
          vendors: [],
          jobWorks: [],
          dispatches: [],
          receipts: [],
          payments: [],
          activityLogs: [],
          references: [],
          sharedVariants: [],
          stockTransactions: [],
          toasts: [],
          jobCounter: 0,
          challanCounter: 0,
          settings: DEFAULT_SETTINGS,
        });

        get().addToast('All data cleared.', 'info');
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
      },

      deleteJobWork: (id) => {
        const job = get().jobWorks.find((j) => j.id === id);
        set((s) => ({ jobWorks: s.jobWorks.filter((j) => j.id !== id) }));
        void deleteJobWorkRecord(id);
        get().addActivity('JobWork', id, `Job Work ${job?.jobNumber ?? id} deleted`);
        get().addToast(`Job Work ${job?.jobNumber ?? ''} deleted`);
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
        return dispatch.id;
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
      },

      addPayment: (payment) => {
        const p: Payment = { ...payment, id: generateId('pay') };
        set((s) => ({ payments: [p, ...s.payments] }));
        void savePayment(p);
        get().addToast('Payment saved');
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
      },

      updateReference: (id, data) => {
        set((s) => ({
          references: s.references.map((r) => (r.id === id ? { ...r, ...data } : r)),
        }));
        const updated = get().references.find((r) => r.id === id);
        if (updated) void saveReference(updated);
      },

      deleteReference: (id) => {
        set((s) => ({ references: s.references.filter((r) => r.id !== id) }));
        void deleteReferenceRecord(id);
        get().addToast('Reference deleted');
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
      },

      updateSharedVariant: (id, data) => {
        set((s) => ({
          sharedVariants: s.sharedVariants.map((sv) => (sv.id === id ? { ...sv, ...data } : sv)),
        }));
        const updated = get().sharedVariants.find((sv) => sv.id === id);
        if (updated) void saveSharedVariant(updated);
        get().addToast('Shared variant updated');
      },

      deleteSharedVariant: (id) => {
        set((s) => ({ sharedVariants: s.sharedVariants.filter((sv) => sv.id !== id) }));
        void deleteSharedVariantRecord(id);
        get().addToast('Shared variant deleted');
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
